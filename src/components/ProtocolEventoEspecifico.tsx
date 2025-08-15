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

  // Inicializar o protocolo
  React.useEffect(() => {
    if (currentStep === 1) {
      normalizeEvent();
    }
  }, []);

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
      }
    } catch (error) {
      console.error('Erro ao normalizar evento:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEventSelection = (event: string) => {
    setSelectedEvent(event);
    setCurrentStep(3);
    setShowSentiments(true);
  };

  const handleSentimentsSelected = async (sentiments: string[]) => {
    setShowSentiments(false);
    setCurrentStep(4);
    
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
      
      if (data?.commands) {
        onComplete({
          type: 'quantum_commands',
          commands: data.commands,
          event: selectedEvent,
          sentimentCount: sentiments.length
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