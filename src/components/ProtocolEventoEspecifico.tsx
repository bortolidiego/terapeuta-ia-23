import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SentimentosPopup from "@/components/SentimentosPopup";
import { supabase } from "@/integrations/supabase/client";

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

  // Inicializar o protocolo
  React.useEffect(() => {
    initializeProtocol();
  }, []);

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
    
    // Salvar estado final
    await saveProtocolState(4, { selectedSentiments: sentiments });
    
    try {
      const { data, error } = await supabase.functions.invoke('protocol-executor', {
        body: {
          sessionId,
          action: 'generate_commands',
          actionData: {
            selectedEvent,
            selectedSentiments: sentiments
          }
        }
      });

      if (error) throw error;
      
      // Marcar protocolo como concluído
      if (protocolId) {
        await supabase
          .from('session_protocols')
          .update({ status: 'completed' })
          .eq('id', protocolId);
      }
      
      if (data?.commands) {
        onComplete({
          type: 'quantum_commands',
          commands: data.commands,
          event: selectedEvent,
          sentimentCount: sentiments.length,
          sentiments: sentiments
        });
      }
    } catch (error) {
      console.error('Erro ao gerar comandos:', error);
    }
  };

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

  // Step 4: Gerando comandos
  if (currentStep === 4) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Gerando comandos quânticos...</p>
        </div>
      </Card>
    );
  }

  return null;
};