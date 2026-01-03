import { useState, useEffect } from "react";
import { ProtocolEventoEspecifico } from "@/components/ProtocolEventoEspecifico";
import { ProtocolSimples } from "@/components/ProtocolSimples";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ProtocolExecutorProps {
  sessionId: string;
  userMessage: string;
  onComplete: (result: any) => void;
}

// Protocolos que requerem seleção de sentimentos (40+ itens)
const PROTOCOLS_WITH_SENTIMENTS = [
  'tee',
  'ter',
  'evento_traumatico_especifico',
  'privacoes',
  'periodo_inconsciente'
];

// Protocolos simples (não requerem seleção de sentimentos)
const SIMPLE_PROTOCOLS = [
  'condicionamentos',
  'crencas',
  'hereditariedades',
  'sequencia_generica',
  'sequencia_dependencia',
  'desconexao_parcial',
  'desconexao_total',
  'desconexao_fora_materia',
  'limpeza_diaria',
  'limpeza_pos_desconexao',
  'programacao_emocional',
  'programacao_mental',
  'programacao_material',
  'desintoxicacao_quantica',
  'antes_ingerir_substancias',
  'gerar_substancias'
];

export const ProtocolExecutor = ({ sessionId, userMessage, onComplete }: ProtocolExecutorProps) => {
  const [protocolType, setProtocolType] = useState<string>('');
  const [isClassifying, setIsClassifying] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkExistingProtocol();
  }, []);

  const checkExistingProtocol = async () => {
    try {
      // Verificar se há protocolo em andamento para esta sessão
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
        // Protocolo existente encontrado - restaurar
        console.log('Restaurando protocolo existente:', existingProtocol);
        const protocolData = existingProtocol.protocol_data as any;
        setProtocolType(protocolData?.protocolType || 'evento_traumatico_especifico');
        setIsClassifying(false);
        return;
      }

      // Não há protocolo em andamento - classificar nova mensagem
      await classifyProtocol();
    } catch (error) {
      console.error('Erro ao verificar protocolo existente:', error);
      // Se erro, classificar normalmente
      await classifyProtocol();
    }
  };

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

  const cancelProtocol = async () => {
    try {
      // Cancelar protocolo ativo no banco
      await supabase
        .from('session_protocols')
        .update({ status: 'cancelled' })
        .eq('session_id', sessionId)
        .eq('status', 'active');

      toast({
        title: "Protocolo cancelado",
        description: "Você pode continuar a conversa normalmente.",
      });

      onComplete({ type: 'cancelled', message: 'Protocolo cancelado pelo usuário.' });
    } catch (error) {
      console.error('Erro ao cancelar protocolo:', error);
    }
  };

  // Estado de carregamento
  if (isClassifying) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Identificando protocolo apropriado...</p>
      </div>
    );
  }

  // Se não há protocolo identificado
  if (!protocolType) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-muted-foreground">Não foi possível identificar o protocolo.</p>
        <Button variant="outline" size="sm" onClick={cancelProtocol}>
          <X className="h-4 w-4 mr-2" />
          Cancelar e voltar ao chat
        </Button>
      </div>
    );
  }

  // Protocolos que requerem seleção de sentimentos
  if (PROTOCOLS_WITH_SENTIMENTS.includes(protocolType)) {
    return (
      <ProtocolEventoEspecifico
        sessionId={sessionId}
        userMessage={userMessage}
        onComplete={onComplete}
      />
    );
  }

  // Protocolos simples
  if (SIMPLE_PROTOCOLS.includes(protocolType)) {
    return (
      <ProtocolSimples
        sessionId={sessionId}
        protocolType={protocolType}
        userMessage={userMessage}
        onComplete={onComplete}
      />
    );
  }

  // Protocolo não reconhecido
  return (
    <div className="p-6 text-center space-y-4">
      <p className="text-muted-foreground">Protocolo não reconhecido: {protocolType}</p>
      <Button variant="outline" size="sm" onClick={cancelProtocol}>
        <X className="h-4 w-4 mr-2" />
        Cancelar e voltar ao chat
      </Button>
    </div>
  );
};

