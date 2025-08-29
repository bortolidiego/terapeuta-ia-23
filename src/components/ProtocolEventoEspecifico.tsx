import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SentimentosPopup from "@/components/SentimentosPopup";
import { supabase } from "@/integrations/supabase/client";
import { useAudioAssembly } from "@/hooks/useAudioAssembly";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface ProtocolEventoEspecificoProps {
  sessionId: string;
  userMessage: string;
  onComplete: (result: any) => void;
}

export const ProtocolEventoEspecifico = ({ 
  sessionId, 
  userMessage, 
  onComplete 
}: ProtocolEventoEspecificoProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [eventVariations, setEventVariations] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [showSentiments, setShowSentiments] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { currentJob, isProcessing: isAssemblyProcessing, startAudioAssembly, clearCurrentJob, retryAssembly, canRetry } = useAudioAssembly(sessionId);

  // Inicializar o protocolo
  React.useEffect(() => {
    initializeProtocol();
    setStartTime(Date.now());
  }, []);

  // Timeout de 30 segundos para protocolo travado
  React.useEffect(() => {
    if (startTime && isProcessing) {
      const timeoutId = setTimeout(() => {
        setError("Protocolo demorou muito para responder. Tente novamente.");
        setIsProcessing(false);
      }, 30000);

      return () => clearTimeout(timeoutId);
    }
  }, [startTime, isProcessing]);

  const initializeProtocol = async () => {
    try {
      // Verificar se há protocolo existente
      const { data: existingProtocol, error: protocolError } = await supabase
        .from('session_protocols')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (protocolError && protocolError.code !== 'PGRST116') {
        throw protocolError;
      }

      if (existingProtocol) {
        // Restaurar estado do protocolo
        console.log('Restaurando estado do protocolo:', existingProtocol);
        const protocolData = existingProtocol.protocol_data as any;
        
        setProtocolId(existingProtocol.id);
        setCurrentStep(existingProtocol.current_step);
        
        if (protocolData.eventVariations) {
          setEventVariations(protocolData.eventVariations);
        }
        if (protocolData.selectedEvent) {
          setSelectedEvent(protocolData.selectedEvent);
        }
        
        // Se estiver na etapa de sentimentos, mostrar popup
        if (existingProtocol.current_step === 3) {
          setShowSentiments(true);
        }
        
        // Se estiver na etapa 4 e houve erro de montagem, permitir retry
        if (existingProtocol.current_step === 4) {
          // Verificar se houve job de assembly falhado
          const { data: failedJob } = await supabase
            .from('assembly_jobs')
            .select('*')
            .eq('session_id', sessionId)
            .eq('status', 'failed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (failedJob) {
            console.log('Job falhado encontrado, permitindo retry');
          }
        }
        
        return;
      }

      // Novo protocolo - iniciar normalização
      if (currentStep === 1) {
        await normalizeEvent();
      }
    } catch (error) {
      console.error('Erro ao inicializar protocolo:', error);
      // Se erro, iniciar novo protocolo
      if (currentStep === 1) {
        await normalizeEvent();
      }
    }
  };

  const saveProtocolState = async (step: number, data: any) => {
    try {
      const protocolData = {
        protocolType: 'evento_traumatico_especifico',
        userMessage,
        eventVariations,
        selectedEvent,
        ...data
      };

      if (protocolId) {
        // Atualizar protocolo existente
        await supabase
          .from('session_protocols')
          .update({
            current_step: step,
            protocol_data: protocolData,
            updated_at: new Date().toISOString()
          })
          .eq('id', protocolId);
      } else {
        // Criar novo protocolo
        const { data: newProtocol, error } = await supabase
          .from('session_protocols')
          .insert({
            session_id: sessionId,
            protocol_id: crypto.randomUUID(),
            current_step: step,
            protocol_data: protocolData,
            status: 'active'
          })
          .select()
          .single();

        if (error) throw error;
        setProtocolId(newProtocol.id);
      }
    } catch (error) {
      console.error('Erro ao salvar estado do protocolo:', error);
    }
  };

  const normalizeEvent = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('protocol-executor', {
        body: {
          sessionId,
          action: 'normalize_event',
          userMessage
        }
      });

      if (error) throw error;
      
      if (data?.variations) {
        setEventVariations(data.variations);
        setCurrentStep(2);
        
        // Salvar estado
        await saveProtocolState(2, { eventVariations: data.variations });
      }
    } catch (error) {
      console.error('Erro ao normalizar evento:', error);
      setError("Erro ao processar evento. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEventSelection = async (event: string) => {
    setSelectedEvent(event);
    setCurrentStep(3);
    setShowSentiments(true);
    
    // Salvar estado
    await saveProtocolState(3, { selectedEvent: event });
  };

  const handleSentimentsSelected = async (sentiments: string[]) => {
    setShowSentiments(false);
    setCurrentStep(4);
    setError(null);
    
    // Salvar estado final
    await saveProtocolState(4, { selectedSentiments: sentiments });
    
    try {
      // Reativar sessão se estiver pausada
      console.log('Verificando e reativando sessão se necessário...');
      const { data: sessionData, error: sessionError } = await supabase
        .from('therapy_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (!sessionError && sessionData?.status === 'paused') {
        console.log('Reativando sessão pausada');
        await supabase
          .from('therapy_sessions')
          .update({ status: 'active' })
          .eq('id', sessionId);
      }

      // Gerar instruções de assembly com timeout
      console.log('Gerando comandos de assembly...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na geração de comandos')), 25000);
      });

      const executorPromise = supabase.functions.invoke('protocol-executor', {
        body: {
          sessionId,
          action: 'generate_commands',
          data: {
            selectedEvent,
            selectedSentiments: sentiments
          }
        }
      });

      const result = await Promise.race([executorPromise, timeoutPromise]) as any;
      const { data, error } = result;

      if (error) throw error;
      
      // Verificar se temos assemblyInstructions
      if (data?.assemblyInstructions) {
        console.log('Starting audio assembly with instructions:', data.assemblyInstructions);
        
        // Iniciar montagem de áudio
        const assemblyInstructions = {
          sessionId,
          assemblySequence: data.assemblyInstructions.assemblySequence,
          totalEstimatedDuration: data.assemblyInstructions.totalEstimatedDuration || 0
        };
        
        await startAudioAssembly(assemblyInstructions);
        
        // Marcar protocolo como concluído
        if (protocolId) {
          await supabase
            .from('session_protocols')
            .update({ status: 'completed' })
            .eq('id', protocolId);
        }
        
        // Passar resultado para o componente pai
        onComplete({
          type: 'audio_assembly_started',
          assemblyInstructions: data.assemblyInstructions,
          event: selectedEvent,
          sentimentCount: sentiments.length,
          sentiments: sentiments
        });
      } else {
        throw new Error('Instruções de assembly não foram geradas');
      }
    } catch (error) {
      console.error('Erro ao gerar comandos:', error);
      setError("Erro ao iniciar montagem de áudio. Tente novamente.");
    }
  };

  const resetProtocol = () => {
    setCurrentStep(1);
    setEventVariations([]);
    setSelectedEvent("");
    setShowSentiments(false);
    setIsProcessing(false);
    setError(null);
    setStartTime(Date.now());
    clearCurrentJob();
    initializeProtocol();
  };

  // Exibir erro se houver
  if (error) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={resetProtocol} variant="outline">
            Tentar Novamente
          </Button>
        </div>
      </Card>
    );
  }

  // Step 1: Processando
  if (currentStep === 1) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Processando seu evento...</p>
        </div>
      </Card>
    );
  }

  // Step 2: Seleção de variação do evento
  if (currentStep === 2 && eventVariations.length > 0) {
    return (
      <Card className="p-6">
        <p className="mb-4 font-medium">
          Selecione a frase que melhor define o momento do evento:
        </p>
        <div className="space-y-2">
          {eventVariations.map((variation, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full text-left justify-start"
              onClick={() => handleEventSelection(variation)}
              disabled={isProcessing}
            >
              {variation}
            </Button>
          ))}
        </div>
      </Card>
    );
  }

  // Step 3: Seleção de sentimentos
  if (currentStep === 3) {
    return (
      <div>
        <Card className="p-6 mb-4">
          <p className="font-medium">Evento selecionado:</p>
          <p className="text-muted-foreground">{selectedEvent}</p>
        </Card>
        {showSentiments && (
          <SentimentosPopup
            isOpen={true}
            onClose={() => setShowSentiments(false)}
            onConfirm={handleSentimentsSelected}
            context={selectedEvent}
          />
        )}
      </div>
    );
  }

  // Step 4: Gerando comandos e montando áudio
  if (currentStep === 4) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <div>
              <p className="text-muted-foreground">
                {isAssemblyProcessing ? 'Montando áudio personalizado...' : 'Gerando instruções...'}
              </p>
              {currentJob && (
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso:</span>
                    <span>{currentJob.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentJob.progress_percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Mostrar botão de retry se houver erro e puder tentar novamente */}
          {canRetry && (
            <div className="mt-4">
              <Button
                onClick={retryAssembly}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente Montagem
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return null;
};