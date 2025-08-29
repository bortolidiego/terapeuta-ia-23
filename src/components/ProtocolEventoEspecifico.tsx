import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SentimentosPopup from "@/components/SentimentosPopup";
import { supabase } from "@/integrations/supabase/client";
import { useAudioAssembly } from "@/hooks/useAudioAssembly";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertCircle, Wifi, WifiOff } from "lucide-react";

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
  const [currentStep, setCurrentStep] = useState('health_check');
  const [eventVariations, setEventVariations] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [showSentiments, setShowSentiments] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [sessionReactivated, setSessionReactivated] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  
  const { toast } = useToast();
  const { currentJob, isProcessing: isAssemblyProcessing, startAudioAssembly, clearCurrentJob, retryAssembly, canRetry } = useAudioAssembly(sessionId);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setDiagnosticLogs(prev => [...prev, logEntry]);
  };

  // Verificação de saúde das edge functions
  const performHealthCheck = async () => {
    addLog("Iniciando verificação de saúde do sistema...");
    
    try {
      // Testar conectividade básica
      addLog("Testando conectividade com protocol-executor...");
      const healthResult = await Promise.race([
        supabase.functions.invoke('protocol-executor', {
          body: { action: 'health_check', sessionId }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na verificação de saúde')), 5000)
        )
      ]);

      setIsHealthy(true);
      addLog("✅ Sistema saudável - procedendo com inicialização");
      await initializeProtocol();
    } catch (error) {
      addLog(`❌ Problema detectado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setIsHealthy(false);
      setCurrentStep('recovery');
      setError('Sistema temporariamente indisponível. Tente o modo de recuperação.');
    }
  };

  // Reativar sessão com robustez
  const ensureSessionActive = async () => {
    try {
      addLog("Verificando status da sessão...");
      const { data: sessionData, error: sessionError } = await supabase
        .from('therapy_sessions')
        .select('status, id')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) {
        addLog(`Erro ao verificar sessão: ${sessionError.message}`);
        throw sessionError;
      }

      if (!sessionData) {
        addLog("❌ Sessão não encontrada!");
        throw new Error('Sessão não encontrada');
      }

      if (sessionData.status === 'paused') {
        addLog("🔄 Reativando sessão pausada...");
        const { error: updateError } = await supabase
          .from('therapy_sessions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', sessionId);

        if (updateError) {
          addLog(`Erro ao reativar sessão: ${updateError.message}`);
          throw updateError;
        }

        setSessionReactivated(true);
        addLog("✅ Sessão reativada com sucesso");
      } else {
        addLog(`✅ Sessão já está ${sessionData.status}`);
      }

      return true;
    } catch (error) {
      addLog(`❌ Falha na reativação da sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return false;
    }
  };

  // Inicializar com logs detalhados
  React.useEffect(() => {
    performHealthCheck();
    setStartTime(Date.now());
  }, []);

  // Timeout robusto
  React.useEffect(() => {
    if (startTime && isProcessing && currentStep !== 'health_check') {
      const timeoutId = setTimeout(() => {
        addLog("⏰ Timeout detectado - forçando modo de recuperação");
        setError("Operação demorou muito. Ativando modo de recuperação.");
        setCurrentStep('recovery');
        setIsProcessing(false);
      }, 20000); // Reduzido para 20s

      return () => clearTimeout(timeoutId);
    }
  }, [startTime, isProcessing, currentStep]);

  const initializeProtocol = async () => {
    try {
      addLog("Inicializando protocolo...");
      setCurrentStep('processing');
      
      // Garantir que a sessão está ativa
      const sessionOk = await ensureSessionActive();
      if (!sessionOk) {
        throw new Error('Falha na reativação da sessão');
      }

      // Verificar protocolo existente
      addLog("Verificando protocolos existentes...");
      const { data: existingProtocol, error: protocolError } = await supabase
        .from('session_protocols')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (protocolError && protocolError.code !== 'PGRST116') {
        addLog(`Erro ao buscar protocolo: ${protocolError.message}`);
        throw protocolError;
      }

      if (existingProtocol) {
        addLog("📋 Restaurando protocolo existente...");
        const protocolData = existingProtocol.protocol_data as any;
        
        setProtocolId(existingProtocol.id);
        
        if (protocolData.eventVariations && protocolData.eventVariations.length > 0) {
          setEventVariations(protocolData.eventVariations);
          setCurrentStep('selecting_event');
          addLog("✅ Protocolo restaurado - seleção de evento");
          return;
        }
        
        if (protocolData.selectedEvent) {
          setSelectedEvent(protocolData.selectedEvent);
          if (existingProtocol.current_step === 3) {
            setCurrentStep('selecting_sentiments');
            setShowSentiments(true);
            addLog("✅ Protocolo restaurado - seleção de sentimentos");
            return;
          }
        }
      }

      // Novo protocolo - normalizar evento
      addLog("🔄 Iniciando normalização de evento...");
      await normalizeEvent();
    } catch (error) {
      addLog(`❌ Erro na inicialização: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setError("Erro na inicialização. Tente o modo de recuperação.");
      setCurrentStep('recovery');
    }
  };

  const saveProtocolState = async (step: number, data: any) => {
    try {
      addLog(`💾 Salvando estado do protocolo (step ${step})...`);
      const protocolData = {
        protocolType: 'evento_traumatico_especifico',
        userMessage,
        eventVariations,
        selectedEvent,
        ...data
      };

      if (protocolId) {
        await supabase
          .from('session_protocols')
          .update({
            current_step: step,
            protocol_data: protocolData,
            updated_at: new Date().toISOString()
          })
          .eq('id', protocolId);
      } else {
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
      addLog("✅ Estado salvo com sucesso");
    } catch (error) {
      addLog(`❌ Erro ao salvar estado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const normalizeEvent = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      addLog("🔄 Normalizando evento...");
      
      const normalizePromise = supabase.functions.invoke('protocol-executor', {
        body: {
          sessionId,
          action: 'normalize_event',
          userMessage
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na normalização')), 15000);
      });

      const result = await Promise.race([normalizePromise, timeoutPromise]) as any;
      const { data, error } = result;

      if (error) {
        addLog(`❌ Erro na normalização: ${error.message}`);
        throw error;
      }
      
      if (data?.variations && data.variations.length > 0) {
        addLog(`✅ Evento normalizado - ${data.variations.length} variações recebidas`);
        setEventVariations(data.variations);
        setCurrentStep('selecting_event');
        await saveProtocolState(2, { eventVariations: data.variations });
      } else {
        throw new Error('Nenhuma variação de evento foi retornada');
      }
    } catch (error) {
      addLog(`❌ Falha na normalização: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setRetryCount(prev => prev + 1);
      
      if (retryCount < 2) {
        addLog(`🔄 Tentativa ${retryCount + 1}/3 em 3 segundos...`);
        setTimeout(() => normalizeEvent(), 3000);
      } else {
        setError("Falha na normalização do evento. Tente o modo de recuperação.");
        setCurrentStep('recovery');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEventSelection = async (event: string) => {
    addLog(`📝 Evento selecionado: ${event}`);
    setSelectedEvent(event);
    setCurrentStep('selecting_sentiments');
    setShowSentiments(true);
    await saveProtocolState(3, { selectedEvent: event });
  };

  const handleSentimentsSelected = async (sentiments: string[]) => {
    addLog(`🎭 ${sentiments.length} sentimentos selecionados`);
    setShowSentiments(false);
    setCurrentStep('generating_audio');
    setError(null);
    
    await saveProtocolState(4, { selectedSentiments: sentiments });
    
    try {
      // Garantir sessão ativa novamente
      await ensureSessionActive();

      addLog("🎵 Gerando comandos de montagem de áudio...");
      
      const generatePromise = supabase.functions.invoke('protocol-executor', {
        body: {
          sessionId,
          action: 'generate_commands',
          actionData: {
            selectedEvent,
            selectedSentiments: sentiments
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na geração de comandos')), 15000);
      });

      const result = await Promise.race([generatePromise, timeoutPromise]) as any;
      const { data, error } = result;

      if (error) {
        addLog(`❌ Erro na geração: ${error.message}`);
        throw error;
      }
      
      if (data?.assemblySequence) {
        addLog(`✅ Instruções geradas - iniciando montagem de áudio`);
        addLog(`📊 Sequências: ${data.assemblySequence.length}, Componentes faltantes: ${data.missingComponents?.length || 0}`);
        
        // Calcular duração total a partir das sequências
        const totalDuration = data.assemblySequence.reduce((total, seq) => total + (seq.estimatedDuration || 0), 0);
        
        const assemblyInstructions = {
          sessionId,
          assemblySequence: data.assemblySequence,
          totalEstimatedDuration: totalDuration
        };
        
        await startAudioAssembly(assemblyInstructions);
        
        if (protocolId) {
          await supabase
            .from('session_protocols')
            .update({ status: 'completed' })
            .eq('id', protocolId);
        }
        
        addLog("🎉 Protocolo concluído com sucesso!");
        
        onComplete({
          type: 'audio_assembly_started',
          assemblyInstructions: data, // data já é o objeto de instruções
          event: selectedEvent,
          sentimentCount: sentiments.length,
          sentiments: sentiments
        });
      } else {
        addLog(`❌ Dados inválidos recebidos: ${JSON.stringify(data)}`);
        throw new Error('Instruções de assembly não foram geradas');
      }
    } catch (error) {
      addLog(`❌ Falha na geração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setError("Erro ao iniciar montagem de áudio. Verifique os logs e tente novamente.");
      setCurrentStep('recovery');
    }
  };

  const forceRecovery = async () => {
    addLog("🚑 Iniciando modo de recuperação forçada...");
    setRetryCount(0);
    setError(null);
    clearCurrentJob();
    setSessionReactivated(false);
    
    // Limpar protocolos órfãos
    try {
      await supabase
        .from('session_protocols')
        .update({ status: 'cancelled' })
        .eq('session_id', sessionId)
        .eq('status', 'active');
      
      addLog("🧹 Protocolos órfãos limpos");
    } catch (error) {
      addLog(`⚠️ Erro na limpeza: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    
    // Forçar reativação
    await ensureSessionActive();
    
    // Reiniciar do zero
    setCurrentStep('health_check');
    await performHealthCheck();
  };

  const resetProtocol = () => {
    addLog("🔄 Resetando protocolo...");
    setCurrentStep('health_check');
    setEventVariations([]);
    setSelectedEvent("");
    setShowSentiments(false);
    setIsProcessing(false);
    setError(null);
    setStartTime(Date.now());
    setRetryCount(0);
    clearCurrentJob();
    performHealthCheck();
  };

  // Health Check Screen
  if (currentStep === 'health_check') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <div>
            <p className="text-muted-foreground">Verificando sistema...</p>
            {isHealthy === false && (
              <p className="text-sm text-destructive mt-1">Sistema indisponível</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Recovery Mode
  if (currentStep === 'recovery') {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-medium">Modo de Recuperação</h3>
          </div>
          
          {error && (
            <p className="text-sm text-muted-foreground">{error}</p>
          )}
          
          <div className="space-y-2">
            <Button onClick={forceRecovery} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recuperação Forçada
            </Button>
            <Button onClick={resetProtocol} variant="outline" className="w-full">
              Reiniciar Completamente
            </Button>
          </div>
          
          {diagnosticLogs.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Logs de Diagnóstico ({diagnosticLogs.length})
              </summary>
              <div className="mt-2 p-3 bg-muted rounded text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
                {diagnosticLogs.slice(-10).map((log, index) => (
                  <div key={index} className="text-muted-foreground">{log}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      </Card>
    );
  }

  // Error Screen
  if (error && currentStep !== 'recovery' && currentStep !== 'health_check') {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <div className="space-y-2">
            <Button onClick={resetProtocol} variant="outline" className="w-full">
              Tentar Novamente
            </Button>
            <Button onClick={() => setCurrentStep('recovery')} variant="ghost" size="sm" className="w-full">
              Modo de Recuperação
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Processing Screen
  if (currentStep === 'processing') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <div>
            <p className="text-muted-foreground">Processando seu evento...</p>
            {sessionReactivated && (
              <p className="text-xs text-green-600 mt-1">✅ Sessão reativada</p>
            )}
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Tentativa {retryCount + 1}/3</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Event Selection Screen
  if (currentStep === 'selecting_event' && eventVariations.length > 0) {
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

  // Sentiment Selection Screen
  if (currentStep === 'selecting_sentiments') {
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

  // Audio Generation Screen
  if (currentStep === 'generating_audio') {
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
          
          {canRetry && (
            <div className="space-y-2">
              <Button
                onClick={retryAssembly}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente Montagem
              </Button>
              <Button
                onClick={() => setCurrentStep('recovery')}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                Modo de Recuperação
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return null;
};