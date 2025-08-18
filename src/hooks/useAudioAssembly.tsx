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
  event: string;
  eventEssence: string;
  protocolType: string;
  baseComponents: string[];
  dynamicElements: {
    selectedSentiments: string[];
    eventText: string;
  };
  assemblyOrder: Array<{
    componentKey: string;
    replacements: Record<string, string>;
    type: string;
  }>;
  estimatedDuration: number;
  totalComponents: number;
}

export const useAudioAssembly = (sessionId?: string) => {
  const [currentJob, setCurrentJob] = useState<AssemblyJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Escutar mudanças em tempo real no job atual
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

          // Notificar mudanças importantes
          if (updatedJob.status === 'completed') {
            setIsProcessing(false);
            toast({
              title: 'Áudio Pronto!',
              description: `Sua montagem de áudio foi concluída em ${Math.round((updatedJob.total_duration_seconds || 0) / 60)} minutos.`,
            });
          } else if (updatedJob.status === 'failed') {
            setIsProcessing(false);
            toast({
              title: 'Erro na Montagem',
              description: updatedJob.error_message || 'Falha ao processar o áudio.',
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentJob?.id, toast]);

  const startAudioAssembly = async (assemblyInstructions: AssemblyInstructions) => {
    try {
      setIsProcessing(true);

      const { data, error } = await supabase.functions.invoke('audio-assembly', {
        body: {
          assemblyInstructions,
          sessionId,
          userId: (await supabase.auth.getUser()).data.user?.id
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Buscar o job criado
      const { data: job, error: jobError } = await supabase
        .from('assembly_jobs')
        .select('*')
        .eq('id', data.jobId)
        .single();

      if (jobError) {
        throw new Error(jobError.message);
      }

      setCurrentJob(job);

      toast({
        title: 'Montagem Iniciada',
        description: `Processamento iniciado! Duração estimada: ${Math.round(assemblyInstructions.estimatedDuration / 60)} minutos.`,
      });

      return data.jobId;
    } catch (error) {
      console.error('Error starting audio assembly:', error);
      setIsProcessing(false);
      
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a montagem de áudio.',
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

  const clearCurrentJob = () => {
    setCurrentJob(null);
    setIsProcessing(false);
  };

  return {
    currentJob,
    isProcessing,
    startAudioAssembly,
    getJobStatus,
    getAudioUrl,
    clearCurrentJob,
  };
};