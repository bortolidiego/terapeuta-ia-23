import { useState, useEffect } from "react";
import { ProtocolEventoEspecifico } from "@/components/ProtocolEventoEspecifico";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProtocolExecutorProps {
  sessionId: string;
  userMessage: string;
  onComplete: (result: any) => void;
}

export const ProtocolExecutor = ({ sessionId, userMessage, onComplete }: ProtocolExecutorProps) => {
  const [protocolType, setProtocolType] = useState<string>('');
  const [isClassifying, setIsClassifying] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    classifyProtocol();
  }, []);

  const classifyProtocol = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('protocol-executor', {
        body: {
          sessionId,
          action: 'classify_protocol',
          userMessage
        }
      });

      if (error) throw error;
      
      const protocol = data?.protocol;
      if (!protocol || protocol === 'none') {
        // Não é um protocolo, retornar para chat normal
        onComplete({ type: 'no_protocol', message: 'Esta mensagem não requer um protocolo específico.' });
        return;
      }
      setProtocolType(protocol);
    } catch (error) {
      console.error('Erro ao classificar protocolo:', error);
      toast({
        title: "Erro no protocolo",
        description: "Não foi possível identificar o protocolo apropriado",
        variant: "destructive",
      });
    } finally {
      setIsClassifying(false);
    }
  };

  if (isClassifying) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Identificando protocolo apropriado...</p>
      </div>
    );
  }

  // Renderizar protocolo específico
  if (protocolType === 'evento_traumatico_especifico') {
    return (
      <ProtocolEventoEspecifico
        sessionId={sessionId}
        userMessage={userMessage}
        onComplete={onComplete}
      />
    );
  }

  return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Protocolo não reconhecido: {protocolType}</p>
    </div>
  );
};

