import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Settings, Power, Search, Mic, Square } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SentimentosPopup from "./SentimentosPopup";
import { SearchDialog } from "./SearchDialog";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface Message {
  id: string;
  role: "user" | "assistant" | "consultation_end";
  content: string;
  created_at: string;
  buttons?: Array<{id: string; text: string}>;
  buttonMessage?: string;
  metadata?: any;
}

export const SimplifiedChat = () => {
  console.log('SimplifiedChat: Componente carregado');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSentimentosPopup, setShowSentimentosPopup] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [currentContext, setCurrentContext] = useState<string>("");
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(null);
  const [selectedFactText, setSelectedFactText] = useState<string | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const {
    isRecording,
    isProcessing,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadAllMessages();
  }, []);

  const loadAllMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("session_messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      const typedMessages = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant" | "consultation_end",
        content: msg.content,
        created_at: msg.created_at,
        metadata: (msg as any).metadata
      }));
      setMessages(typedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  };

  const createNewConsultation = async () => {
    try {
      // Obter o usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error("Usuário não autenticado");
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para iniciar uma consulta.",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from("therapy_sessions")
        .insert({ 
          title: `Consulta ${new Date().toLocaleString()}`,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar consulta:", error);
        toast({
          title: "Erro ao criar consulta",
          description: "Não foi possível iniciar uma nova consulta. Tente novamente.",
          variant: "destructive",
        });
        throw error;
      }
      
      setCurrentConsultationId(data.id);
      return data.id;
    } catch (error) {
      console.error("Erro ao criar consulta:", error);
      return null;
    }
  };

  const endCurrentConsultation = async () => {
    if (!currentConsultationId) return;

    try {
      // Inserir marcador de fim de consulta
      const consultationEndMessage = {
        session_id: currentConsultationId,
        role: "assistant",
        content: `Consulta encerrada em ${new Date().toLocaleString()}`,
        metadata: { type: "consultation_end" }
      } as const;

      const { error } = await supabase
        .from("session_messages")
        .insert(consultationEndMessage);

      if (error) throw error;

      // Atualizar estado local
      const newEndMessage: Message = {
        id: Date.now().toString(),
        role: "consultation_end",
        content: consultationEndMessage.content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newEndMessage]);

      setCurrentConsultationId(null);
      toast({
        title: "Consulta encerrada",
        description: "Uma nova consulta será iniciada na próxima mensagem.",
      });
    } catch (error) {
      console.error("Erro ao encerrar consulta:", error);
    }
  };

  const sendMessage = async (messageText?: string) => {
    console.log('sendMessage: Iniciando envio de mensagem');
    console.log('currentConsultationId:', currentConsultationId);
    const actualMessage = messageText || input;
    if (!actualMessage.trim()) return;

    // Se não há consulta ativa, criar uma nova
    let consultationId = currentConsultationId;
    if (!consultationId) {
      console.log('sendMessage: Criando nova consulta');
      consultationId = await createNewConsultation();
      if (!consultationId) return;
      setCurrentConsultationId(consultationId);
    }

    const userMessage = actualMessage;
    setInput("");
    setIsLoading(true);

    try {
      // Salvar mensagem do usuário
      const { error: userError } = await supabase
        .from("session_messages")
        .insert({
          session_id: consultationId,
          role: "user",
          content: userMessage,
        });

      if (userError) throw userError;

      // Atualizar estado local
      const newUserMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newUserMessage]);

      // Chamar edge function
      const { data: response, error: apiError } = await supabase.functions.invoke(
        "therapy-chat",
        {
          body: {
            message: userMessage,
            sessionId: consultationId,
            history: messages.filter(m => m.role !== "consultation_end" && m.metadata?.type !== 'consultation_end'),
          },
        }
      );

      if (apiError) throw apiError;

      // Verificar se é comando de popup de sentimentos
      if (response.reply.includes('[POPUP:sentimentos]')) {
        setPendingResponse(response.reply.replace('[POPUP:sentimentos]', '').trim());
        
        // Extrair contexto das últimas 3 mensagens do usuário
        const recentUserMessages = messages
          .filter(msg => msg.role === 'user')
          .slice(-3)
          .map(msg => msg.content)
          .join(' ');
        
        setCurrentContext(recentUserMessages);
        setShowSentimentosPopup(true);
        setIsLoading(false);
        return;
      }

      // Verificar se é comando quântico estruturado
      let finalResponse = response.reply;
      try {
        const quantumData = JSON.parse(response.reply);
        if (quantumData.type === "quantum_commands") {
          finalResponse = construirComandosQuanticos(
            quantumData.sentimentos,
            quantumData.fatoEspecifico,
            quantumData.message,
            quantumData.postMessage
          );
        }
      } catch (e) {
        // Se não for JSON válido, usar resposta normal
      }

      // Processar resposta para detectar botões
      const processedResponse = processMessageForButtons(finalResponse);

      // Salvar resposta do assistente
      const { error: assistantError } = await supabase
        .from("session_messages")
        .insert({
          session_id: consultationId,
          role: "assistant",
          content: processedResponse.content,
        });

      if (assistantError) throw assistantError;

      // Atualizar estado local
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: processedResponse.content,
        created_at: new Date().toISOString(),
        buttons: processedResponse.buttons,
        buttonMessage: processedResponse.buttonMessage,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const processMessageForButtons = (content: string) => {
    // Remover e interpretar cabeçalho ROUTER, se existir
    const routerHeaderMatch = content.match(/^\s*ROUTER:\s*([A-Z_]+)(?:\s*\|\s*step=([a-z0-9_:-]+))?/i);
    const routerProtocol = routerHeaderMatch ? (routerHeaderMatch[1] || '').toUpperCase() : undefined;
    const routerStep = routerHeaderMatch ? (routerHeaderMatch[2] || '') : undefined;

    if (routerProtocol) {
      console.log('ROUTER detectado no frontend:', { routerProtocol, routerStep });
    }

    // Corpo sem o cabeçalho ROUTER
    const body = content.replace(/^\s*ROUTER:[^\n]*\n?/, '').trim();

    // 1) Detectar formato JSON de botões
    const jsonMatch = body.match(/```json\s*(\{[^`]+\})\s*```/);
    if (jsonMatch) {
      try {
        const buttonData = JSON.parse(jsonMatch[1]);
        if (buttonData.type === "buttons" && buttonData.options) {
          return {
            content: body.replace(/```json\s*\{[^`]+\}\s*```/, '').trim(),
            buttons: buttonData.options,
            buttonMessage: buttonData.message || ""
          };
        }
      } catch (e) {
        console.warn("Erro ao processar JSON de botões:", e);
      }
    }

    // 2) Detectar formato Markdown [BTN:id:text]
    const markdownButtons = body.match(/\[BTN:([^:]+):([^\]]+)\]/g);
    if (markdownButtons) {
      const buttons = markdownButtons.map(btn => {
        const match = btn.match(/\[BTN:([^:]+):([^\]]+)\]/);
        return match ? { id: match[1], text: match[2] } : null;
      }).filter(Boolean);

      if ((buttons as Array<{id: string; text: string}>).length > 0) {
        return {
          content: body.replace(/\[BTN:[^:]+:[^\]]+\]/g, '').trim(),
          buttons: buttons as Array<{id: string; text: string}>,
          buttonMessage: ""
        };
      }
    }

    // 3) Fallback (somente quando o Router indicar FATO_ESPECIFICO na etapa choose_fact):
    if (routerProtocol === 'FATO_ESPECIFICO' && (routerStep === 'choose_fact' || !routerStep)) {
      const lines = body.split('\n');
      const itemRegex = /^\s*(?:\d+[\)\.\-]?\s+|[-*•]\s+)(.+)$/;
      const rawItems = lines
        .map(l => l.match(itemRegex))
        .filter(Boolean)
        .map((m: RegExpMatchArray) => m[1].trim());

      const cleanFactText = (txt: string) => {
        return txt
          .replace(/["“”]/g, '')
          .replace(/\b(me\s+)?senti[^\.,;\]]*/gi, '')
          .replace(/\bfiquei[^\.,;\]]*/gi, '')
          .replace(/\bestava[^\.,;\]]*/gi, '')
          .replace(/\bemocionad[oa][^\.,;\]]*/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .replace(/\.$/, '');
      };

      if (rawItems.length >= 3) {
        const top3 = rawItems.slice(0, 3).map(cleanFactText);
        const buttons: Array<{id: string; text: string}> = [
          { id: 'fato1', text: `${top3[0]}.` },
          { id: 'fato2', text: `${top3[1]}.` },
          { id: 'fato3', text: `${top3[2]}.` }
        ];

        const contentWithoutList = lines.filter(l => !itemRegex.test(l)).join('\n').trim();
        return {
          content: contentWithoutList,
          buttons,
          buttonMessage: 'Escolha a melhor descrição APENAS DO FATO:'
        };
      }
    }

    // 4) Sem botões
    return { content: body, buttons: undefined, buttonMessage: undefined };
  };

  const handleButtonClick = async (buttonId: string, buttonText: string) => {
    // Seleção de uma variação de fato específico
    if (buttonId.startsWith('fato')) {
      setSelectedFactText(buttonText);
      // Enviar mensagem para edge function processar a seleção e verificar fatos pendentes
      await sendMessage(`Fato selecionado: ${buttonText}`);
      return;
    }

    // Autocura agora: mostrar perguntas guias e abrir popup imediatamente
    if (buttonId === 'autocura_agora') {
      const guidance = [
        'Perfeito. Antes de abrirmos a etapa de sentimentos, responda mentalmente às 3 perguntas:',
        '• O que você sentiu na hora ou no dia?',
        '• O que você continuou sentindo depois?',
        '• O que você recebeu desse fato (como te afetou a longo prazo)?',
        '',
        '[POPUP:sentimentos]'
      ].join('\n');

      // Garantir consulta
      let consultationId = currentConsultationId;
      if (!consultationId) {
        consultationId = await createNewConsultation();
        if (!consultationId) return;
        setCurrentConsultationId(consultationId);
      }

      // Persistir resposta do assistente e abrir popup
      try {
        const { error: assistantError } = await supabase
          .from('session_messages')
          .insert({ session_id: consultationId, role: 'assistant', content: guidance });
        if (assistantError) throw assistantError;

        const assistantMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant' as const,
          content: guidance,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Extrair contexto das últimas mensagens do usuário
        const recentUserMessages = messages
          .filter(msg => msg.role === 'user')
          .slice(-3)
          .map(msg => msg.content)
          .join(' ');
        setCurrentContext(recentUserMessages);
        setShowSentimentosPopup(true);
      } catch (e) {
        console.error('Erro ao registrar orientação de autocura:', e);
      }
      return;
    }

    // Autocura depois: registrar fato pendente
    if (buttonId === 'autocura_depois') {
      if (!selectedFactText) {
        toast({
          title: 'Selecione um fato',
          description: 'Escolha uma das três variações do fato antes de salvar para depois.',
          variant: 'destructive',
        });
        return;
      }

      let consultationId = currentConsultationId;
      if (!consultationId) {
        consultationId = await createNewConsultation();
        if (!consultationId) return;
        setCurrentConsultationId(consultationId);
      }

      try {
        const { error: insertError } = await supabase
          .from('therapy_facts')
          .insert({ session_id: consultationId, fact_text: selectedFactText, status: 'pending' });
        if (insertError) throw insertError;

        const confirmation = 'Fato salvo para autocura futura. Vamos seguir com seu atendimento no seu ritmo.';
        const { error: assistantError } = await supabase
          .from('session_messages')
          .insert({ session_id: consultationId, role: 'assistant', content: confirmation });
        if (assistantError) throw assistantError;

        const assistantMessage = {
          id: (Date.now() + 3).toString(),
          role: 'assistant' as const,
          content: confirmation,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setSelectedFactText(null);
      } catch (e) {
        console.error('Erro ao salvar fato pendente:', e);
        toast({ title: 'Erro', description: 'Não foi possível salvar o fato para depois.', variant: 'destructive' });
      }
      return;
    }

    // Botão de finalizar autocura: retornar ao router
    if (buttonId === 'finalizar') {
      await sendMessage('Autocura finalizada, retornar ao início');
      return;
    }
    
    // Botão de encerrar consulta
    if (buttonId === 'encerrar') {
      await endCurrentConsultation();
      return;
    }
    
    // Botão de continuar com novo problema
    if (buttonId === 'sim') {
      await sendMessage('Quero trabalhar outro problema');
      return;
    }

    // Botões de fatos pendentes
    if (buttonId.startsWith('pending_fact_')) {
      const factId = buttonId.replace('pending_fact_', '');
      await sendMessage(`Selecionado fato pendente ID: ${factId}`);
      return;
    }

    // Listar fatos pendentes
    if (buttonId === 'show_pending_facts') {
      await sendMessage('show_pending_facts');
      return;
    }

    // Recomeçar consulta
    if (buttonId === 'recomecar_consulta') {
      await endCurrentConsultation();
      return;
    }

    // Botão de novo problema (legado)
    if (buttonId === 'new_problem') {
      await sendMessage('Quero trabalhar um novo problema');
      return;
    }

    // Qualquer outro botão: enviar ID para o backend
    await sendMessage(buttonId);
  };

  const construirComandosQuanticos = (sentimentos: string[], fatoEspecifico: string, mensagemIntro: string, postMessage?: string) => {
    // Template para cada sentimento selecionado
    const comandosPorSentimento = sentimentos.map(sentimento => 
      `Código ALMA, a minha consciência escolhe: ${sentimento.toUpperCase()} que eu senti ${fatoEspecifico} ACABARAM!`
    );

    // 4 linhas finais obrigatórias
    const linhasFinais = [
      `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi ${fatoEspecifico} ACABARAM!`,
      `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti ${fatoEspecifico} ACABARAM!`,
      `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei ${fatoEspecifico} ACABARAM!`,
      `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi ${fatoEspecifico} ACABARAM!`
    ];

    // Construir mensagem completa - todos os comandos juntos sem separação
    const comandosCompletos = [
      mensagemIntro,
      "",
      "**Comandos Quânticos (Status: Autocura EMITIDA):**",
      ...comandosPorSentimento,
      ...linhasFinais,
      "",
      "✨ Seus comandos quânticos foram criados com sucesso! A autocura foi emitida e está em processo.",
      postMessage || ""
    ];

    return comandosCompletos.join('\n');
  };

  const handleSentimentosConfirm = async (sentimentos: string[]) => {
    setShowSentimentosPopup(false);
    
    // Criar mensagem com os sentimentos selecionados
    const sentimentosMessage = `Sentimentos selecionados: ${sentimentos.join(', ')}`;
    
    // Continuar o processamento com a resposta pendente
    if (pendingResponse && currentConsultationId) {
      try {
        // Salvar resposta do assistente com a mensagem pendente
        const { error: assistantError } = await supabase
          .from("session_messages")
          .insert({
            session_id: currentConsultationId,
            role: "assistant",
            content: pendingResponse,
          });

        if (assistantError) throw assistantError;

        // Atualizar estado local com resposta pendente
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: pendingResponse,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Limpar estado pendente
        setPendingResponse("");
        
        // Enviar automaticamente os sentimentos selecionados
        sendMessage(sentimentosMessage);
      } catch (error) {
        console.error("Erro ao processar sentimentos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível processar os sentimentos selecionados.",
          variant: "destructive",
        });
      }
    }
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      const transcribedText = await stopRecording();
      if (transcribedText.trim()) {
        setInput(transcribedText);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  return (
    <div className="h-dvh bg-background grid grid-rows-[auto_1fr_auto] gap-2 sm:gap-3 p-2 sm:p-3 overflow-hidden">
      {/* Header Fixo */}
      <div className="flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 p-2 sm:p-3 bg-card rounded-lg sm:rounded-xl border border-border shadow-sm">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-primary truncate">
              MyHealing Chat
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Seu espaço de cura e bem-estar</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSearchDialogOpen(true)}
              className="border-primary/30 text-primary hover:bg-primary/10 text-xs sm:text-sm"
            >
              <Search className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Pesquisar</span>
            </Button>
            {currentConsultationId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={endCurrentConsultation}
                className="border-primary/30 text-primary hover:bg-primary/10 text-xs sm:text-sm"
              >
                <Power className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Encerrar Sessão</span>
              </Button>
            )}
            <Link to="/admin">
              <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 text-xs sm:text-sm">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Área de Mensagens - Ocupa todo o espaço restante */}
      <div className="min-h-0 flex-1">
        <Card className="h-full bg-card border-border shadow-sm rounded-xl sm:rounded-2xl">
          <CardContent className="p-0 h-full">
            <ScrollArea className="h-full p-2 sm:p-3">
              <div className="space-y-2 sm:space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-4 sm:py-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 bg-primary rounded-full flex items-center justify-center">
                      <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                    </div>
                    <p className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-primary">
                      Bem-vindo ao MyHealing Chat
                    </p>
                    <p className="text-xs sm:text-sm max-w-xs sm:max-w-md mx-auto leading-relaxed px-4">
                      Sou seu terapeuta virtual. Pode compartilhar seus sentimentos e pensamentos comigo.
                      Estou aqui para escutar e ajudar em sua jornada de cura.
                    </p>
                  </div>
                )}
                
                {messages.map((message) => {
                  if (message.role === "consultation_end" || message.metadata?.type === 'consultation_end') {
                    return (
                      <div key={message.id} className="flex justify-center my-4 sm:my-6">
                        <div className="flex items-center w-full max-w-md">
                          <div className="flex-1 h-px bg-border"></div>
                          <div className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                            {message.content}
                          </div>
                          <div className="flex-1 h-px bg-border"></div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 sm:gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center">
                          <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                        </div>
                      )}
                      
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl sm:rounded-2xl ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        {message.buttonMessage && (
                          <p className="text-xs sm:text-sm mb-2 sm:mb-3 font-medium">{message.buttonMessage}</p>
                        )}
                        <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        
                        {message.buttons && message.buttons.length > 0 && (
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-2">
                            {message.buttons.map((button) => (
                              <Button
                                key={button.id}
                                variant="outline"
                                size="sm"
                                className="text-xs sm:text-sm border-primary/30 text-primary hover:bg-primary/10 h-8 sm:h-9"
                                onClick={() => handleButtonClick(button.id, button.text)}
                                disabled={isLoading}
                              >
                                {button.text}
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        <div className={`text-xs mt-1 sm:mt-2 ${
                          message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      {message.role === "user" && (
                        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent flex items-center justify-center border border-border">
                          <User className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {isLoading && (
                  <div className="flex gap-2 sm:gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                    </div>
                    <div className="bg-muted p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-primary" />
                        <span className="text-xs sm:text-sm text-muted-foreground">Pensando com carinho...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Input Fixo Separado */}
      <div className="flex-shrink-0">
        <Card className="bg-card border-border shadow-sm rounded-xl sm:rounded-2xl">
          <CardContent className="p-2 sm:p-3">
            <div className="flex gap-2 sm:gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={isLoading || isRecording || isProcessing}
                className="flex-1 border-primary/30 focus:border-primary h-10 sm:h-11 text-sm"
              />
              
              {/* Botão do Microfone */}
              <Button 
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isLoading || isProcessing}
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className="h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
              >
                {isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              
              <Button 
                onClick={() => sendMessage()} 
                disabled={isLoading || !input.trim() || isRecording || isProcessing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Indicador de gravação */}
            {isRecording && (
              <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                Gravando... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
            )}
            
            {isProcessing && (
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                Processando áudio...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SentimentosPopup
        isOpen={showSentimentosPopup}
        onClose={() => setShowSentimentosPopup(false)}
        onConfirm={handleSentimentosConfirm}
        context={currentContext}
      />
      
      <SearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        consultationId={currentConsultationId}
      />
    </div>
  );
};