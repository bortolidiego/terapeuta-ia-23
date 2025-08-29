import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface AssemblyJob {
  id: string;
  status: string;
  progress_percentage: number;
  result_audio_path?: string;
  total_duration_seconds?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface AssemblyInstructions {
  sessionId?: string;
  assemblySequence: Array<{
    sequenceId: number;
    components: string[];
    estimatedDuration: number;
  }>;
  totalEstimatedDuration: number;
}

export const useAudioAssembly = (sessionId?: string) => {
  const [currentJob, setCurrentJob] = useState<AssemblyJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastAssemblyInstructions, setLastAssemblyInstructions] = useState<AssemblyInstructions | null>(null);
  const { toast } = useToast();

  // Escutar mudanças em tempo real no job atual com notificações otimizadas
  useEffect(() => {
    if (!currentJob?.id) return;

    const channel = supabase
      .channel('assembly-job-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assembly_jobs',
          filter: `id=eq.${currentJob.id}`
        },
        (payload) => {
          console.log('Assembly job updated:', payload.new);
          const updatedJob = payload.new as AssemblyJob;
          setCurrentJob(updatedJob);

          // OTIMIZAÇÃO: Notificações em marcos importantes (25%, 50%, 75%, 100%)
          const progressMilestones = [25, 50, 75, 100];
          const currentMilestone = progressMilestones.find(
            milestone => updatedJob.progress_percentage >= milestone && 
            (currentJob.progress_percentage || 0) < milestone
          );

          if (currentMilestone && currentMilestone < 100) {
            toast({
              title: `Progresso: ${currentMilestone}%`,
              description: `Sua autocura está ${currentMilestone}% pronta. Tempo estimado restante: ${Math.ceil((100 - currentMilestone) * 0.05)} min.`,
            });
          }

          // Notificar conclusão com link direto
          if (updatedJob.status === 'completed') {
            setIsProcessing(false);
            toast({
              title: '🎉 Sua Autocura Está Pronta!',
              description: `Áudio concluído em ${Math.round((updatedJob.total_duration_seconds || 0) / 60)} minutos.`,
            });
          } else if (updatedJob.status === 'failed') {
            setIsProcessing(false);
            toast({
              title: 'Erro na Montagem',
              description: updatedJob.error_message || 'Falha ao processar o áudio. Tentando novamente...',
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentJob?.id, currentJob?.progress_percentage, toast]);

  const startAudioAssembly = async (assemblyInstructions: AssemblyInstructions, isRetry: boolean = false) => {
    const maxRetries = 3;
    const currentRetry = isRetry ? retryCount + 1 : 0;
    
    try {
      setIsProcessing(true);
      setLastAssemblyInstructions(assemblyInstructions);
      
      if (isRetry) {
        setRetryCount(currentRetry);
        console.log(`Tentativa ${currentRetry} de ${maxRetries} para montagem de áudio`);
      }

      // Reativar sessão se estiver pausada
      const currentSessionId = assemblyInstructions.sessionId || sessionId;
      if (currentSessionId) {
        console.log('Verificando status da sessão...');
        const { data: sessionData, error: sessionError } = await supabase
          .from('therapy_sessions')
          .select('status')
          .eq('id', currentSessionId)
          .single();

        if (!sessionError && sessionData?.status === 'paused') {
          console.log('Reativando sessão pausada para montagem de áudio');
          await supabase
            .from('therapy_sessions')
            .update({ status: 'active' })
            .eq('id', currentSessionId);
          
          toast({
            title: 'Sessão reativada',
            description: 'Sessão foi reativada para permitir a montagem de áudio.',
          });
        }
      }

      // Verificar componentes de áudio necessários
      console.log('Verificando componentes de áudio necessários...');
      const { data: audioComponents, error: componentsError } = await supabase
        .from('audio_components')
        .select('component_key')
        .eq('protocol_type', 'evento_traumatico_especifico');

      if (componentsError) {
        console.error('Erro ao verificar componentes:', componentsError);
      } else {
        console.log(`Encontrados ${audioComponents.length} componentes de áudio`);
      }

      console.log('Invocando função audio-assembly com timeout...');
      
      // Adicionar timeout para evitar travamento
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na função de montagem de áudio')), 30000);
      });

      const assemblyPromise = supabase.functions.invoke('audio-assembly', {
        body: {
          assemblyInstructions,
          sessionId: currentSessionId,
          userId: (await supabase.auth.getUser()).data.user?.id,
          retryAttempt: currentRetry
        }
      });

      const result = await Promise.race([assemblyPromise, timeoutPromise]) as any;
      const { data, error } = result;

      if (error) {
        console.error('Erro na função audio-assembly:', error);
        throw new Error(`Erro na montagem: ${error.message || error.toString()}`);
      }

      if (!data?.jobId) {
        throw new Error('Job ID não foi retornado pela função');
      }

      // Buscar o job criado com retry
      let job = null;
      let jobError = null;
      
      for (let i = 0; i < 3; i++) {
        const result = await supabase
          .from('assembly_jobs')
          .select('*')
          .eq('id', data.jobId)
          .single();
        
        if (result.data) {
          job = result.data;
          break;
        }
        
        jobError = result.error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!job) {
        throw new Error(`Job não encontrado: ${jobError?.message || 'Erro desconhecido'}`);
      }

      setCurrentJob(job);
      setRetryCount(0);

      toast({
        title: isRetry ? `Tentativa ${currentRetry} - Montagem Iniciada` : 'Montagem Iniciada',
        description: `Processamento iniciado! Duração estimada: ${Math.round((assemblyInstructions.totalEstimatedDuration || 0) / 60)} minutos.`,
      });

      return data.jobId;
    } catch (error) {
      console.error(`Erro na montagem (tentativa ${currentRetry}):`, error);
      
      // Retry logic
      if (currentRetry < maxRetries && !isRetry) {
        console.log(`Tentando novamente em 3 segundos... (${currentRetry + 1}/${maxRetries})`);
        
        toast({
          title: `Tentativa ${currentRetry + 1} falhou`,
          description: `Tentando novamente automaticamente... (${currentRetry + 1}/${maxRetries})`,
          variant: 'destructive',
        });
        
        setTimeout(() => {
          startAudioAssembly(assemblyInstructions, true);
        }, 3000);
        
        return;
      }
      
      setIsProcessing(false);
      setRetryCount(0);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: currentRetry >= maxRetries ? 'Falha após múltiplas tentativas' : 'Erro na Montagem',
        description: `${errorMessage}${currentRetry > 0 ? ` (após ${currentRetry} tentativas)` : ''}`,
        variant: 'destructive',
      });
      
      throw error;
    }
  };

  const getJobStatus = async (jobId: string) => {
    try {
      const { data: job, error } = await supabase
        .from('assembly_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return job;
    } catch (error) {
      console.error('Error fetching job status:', error);
      throw error;
    }
  };

  const getAudioUrl = async (audioPath: string) => {
    try {
      const { data } = await supabase.storage
        .from('audio-assembly')
        .createSignedUrl(audioPath, 3600); // 1 hora de validade

      return data?.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }
  };

  const retryAssembly = async () => {
    if (!lastAssemblyInstructions) {
      toast({
        title: 'Erro',
        description: 'Não é possível tentar novamente. Instruções de montagem não encontradas.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Tentando novamente a montagem de áudio...');
    await startAudioAssembly(lastAssemblyInstructions, true);
  };

  const clearCurrentJob = () => {
    setCurrentJob(null);
    setIsProcessing(false);
    setRetryCount(0);
    setLastAssemblyInstructions(null);
  };

  return {
    currentJob,
    isProcessing,
    retryCount,
    startAudioAssembly,
    retryAssembly,
    getJobStatus,
    getAudioUrl,
    clearCurrentJob,
    canRetry: !!lastAssemblyInstructions && !isProcessing,
  };
};