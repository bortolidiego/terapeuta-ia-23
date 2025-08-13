import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageCircle, Bot, User, Settings, Power } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SentimentosPopup from "./SentimentosPopup";

interface Message {
  id: string;
  role: "user" | "assistant" | "session_end";
  content: string;
  created_at: string;
  buttons?: Array<{id: string; text: string}>;
  buttonMessage?: string;
  metadata?: any;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
}

export const TherapyChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSentimentosPopup, setShowSentimentosPopup] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [currentContext, setCurrentContext] = useState<string>("");
  const [selectedFactText, setSelectedFactText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("therapy_sessions")
        .select("id, title, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
      
      if (data && data.length > 0 && !currentSession) {
        setCurrentSession(data[0]);
        loadMessages(data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from("session_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const typedMessages = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant" | "session_end",
        content: msg.content,
        created_at: msg.created_at,
        metadata: (msg as any).metadata
      }));
      setMessages(typedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  };

  const createNewSession = async () => {
    try {
      const { data, error } = await supabase
        .from("therapy_sessions")
        .insert({ title: `Sessão ${new Date().toLocaleDateString()}` })
        .select()
        .single();

      if (error) throw error;
      
      const newSession = data;
      setSessions([newSession, ...sessions]);
      setCurrentSession(newSession);
      setMessages([]);
      
      toast({
        title: "Nova sessão criada",
        description: "Você pode começar uma nova conversa agora.",
      });
    } catch (error) {
      console.error("Erro ao criar sessão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar uma nova sessão.",
        variant: "destructive",
      });
    }
  };

  const endCurrentSession = async () => {
    if (!currentSession) return;

    try {
      const sessionEndMessage = {
        session_id: currentSession.id,
        role: "assistant",
        content: `Sessão encerrada em ${new Date().toLocaleString()}`,
        metadata: { type: "session_end" }
      } as const;

      const { error } = await supabase
        .from("session_messages")
        .insert(sessionEndMessage);

      if (error) throw error;

      const newEndMessage: Message = {
        id: Date.now().toString(),
        role: "session_end",
        content: sessionEndMessage.content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newEndMessage]);

      toast({
        title: "Sessão encerrada",
        description: "Você pode iniciar uma nova sessão a qualquer momento.",
      });
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
      toast({ title: "Erro", description: "Não foi possível encerrar a sessão.", variant: "destructive" });
    }
  };

  const sendMessage = async (messageText?: string) => {
    const actualMessage = messageText || input;
    if (!actualMessage.trim() || !currentSession) return;

    const userMessage = actualMessage;
    setInput("");
    setIsLoading(true);

    try {
      // Salvar mensagem do usuário
      const { error: userError } = await supabase
        .from("session_messages")
        .insert({
          session_id: currentSession.id,
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
            sessionId: currentSession.id,
            history: messages,
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

      // Processar resposta para detectar botões
      const processedResponse = processMessageForButtons(response.reply);

      // Salvar resposta do assistente
      const { error: assistantError } = await supabase
        .from("session_messages")
        .insert({
          session_id: currentSession.id,
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

    // 3) Fallback (somente quando o Router indicar FATO_ESPECIFICO):
    if (routerProtocol === 'FATO_ESPECIFICO') {
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
          { id: 'fato3', text: `${top3[2]}.` },
          { id: 'autocura_agora', text: 'Trabalhar sentimentos agora' },
          { id: 'autocura_depois', text: 'Autocurar depois' },
        ];

        const contentWithoutList = lines.filter(l => !itemRegex.test(l)).join('\n').trim();
        return {
          content: contentWithoutList,
          buttons,
          buttonMessage: 'Escolha a melhor descrição APENAS DO FATO. Depois, selecione se quer autocurar agora ou deixar para depois.'
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

      // Garantir sessão
      if (!currentSession) {
        await createNewSession();
      }

      // Persistir resposta do assistente e abrir popup
      try {
        const { error: assistantError } = await supabase
          .from('session_messages')
          .insert({ session_id: currentSession!.id, role: 'assistant', content: guidance });
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

      if (!currentSession) {
        await createNewSession();
      }

      try {
        const { error: insertError } = await supabase
          .from('therapy_facts')
          .insert({ session_id: currentSession!.id, fact_text: selectedFactText, status: 'pending' });
        if (insertError) throw insertError;

        const confirmation = 'Fato salvo para autocura futura. Vamos seguir com seu atendimento no seu ritmo.';
        const { error: assistantError } = await supabase
          .from('session_messages')
          .insert({ session_id: currentSession!.id, role: 'assistant', content: confirmation });
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
      await endCurrentSession();
      return;
    }

    // Qualquer outro botão: enviar ID para o backend
    await sendMessage(buttonId);
  };

  const handleSentimentosConfirm = async (sentimentos: string[]) => {
    setShowSentimentosPopup(false);
    
    // Criar mensagem com os sentimentos selecionados
    const sentimentosMessage = `Sentimentos selecionados: ${sentimentos.join(', ')}`;
    
    // Continuar o processamento com a resposta pendente
    if (pendingResponse) {
      try {
        // Salvar resposta do assistente com a mensagem pendente
        const { error: assistantError } = await supabase
          .from("session_messages")
          .insert({
            session_id: currentSession!.id,
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

  return (
    <div className="min-h-screen bg-gradient-healing p-4">
      {/* Header com navegação */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="flex justify-between items-center p-6 bg-card/90 backdrop-blur-md rounded-2xl border border-white/20 shadow-healing">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-mystical bg-clip-text text-transparent">
              MyHealing Chat
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Seu espaço de cura e bem-estar</p>
          </div>
          <Link to="/admin">
            <Button variant="outline" size="sm" className="border-white/30 hover:bg-white/10 backdrop-blur-sm">
              <Settings className="h-4 w-4 mr-2" />
              Administração
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Sidebar - Sessões */}
        <Card className="lg:col-span-1 bg-card/90 backdrop-blur-md border-white/20 shadow-healing rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-primary" />
              Suas Sessões
            </CardTitle>
            <Button 
              onClick={createNewSession}
              size="sm"
              className="w-full bg-gradient-healing hover:shadow-glow transition-all duration-300"
            >
              Nova Sessão
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-10rem)]">
              <div className="p-3 space-y-2">
                {sessions.map((session) => (
                  <Button
                    key={session.id}
                    variant={currentSession?.id === session.id ? "default" : "ghost"}
                    className="w-full justify-start text-left h-auto p-3"
                    onClick={() => {
                      setCurrentSession(session);
                      loadMessages(session.id);
                    }}
                  >
                    <div className="truncate">
                      <div className="font-medium text-sm">{session.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Principal */}
        <Card className="lg:col-span-3 bg-card/90 backdrop-blur-md border-white/20 shadow-healing rounded-2xl flex flex-col">
          <CardHeader className="border-b border-white/10 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary drop-shadow-sm" />
              {currentSession ? currentSession.title : "MyHealing Chat"}
            </CardTitle>
            {currentSession && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={endCurrentSession}
                className="border-white/20"
              >
                <Power className="h-4 w-4 mr-2" />
                Encerrar Sessão
              </Button>
            )}
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Área de Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-healing rounded-full flex items-center justify-center shadow-glow">
                      <Bot className="h-8 w-8 text-white drop-shadow-sm" />
                    </div>
                    <p className="text-xl font-medium mb-3 bg-gradient-mystical bg-clip-text text-transparent">
                      Bem-vindo ao MyHealing Chat
                    </p>
                    <p className="text-sm max-w-md mx-auto leading-relaxed">
                      Sou seu terapeuta virtual. Pode compartilhar seus sentimentos e pensamentos comigo.
                      Estou aqui para escutar e ajudar em sua jornada de cura.
                    </p>
                  </div>
                )}
                
                {messages.map((message) => (
                  (message.role === "session_end" || message.metadata?.type === 'session_end') ? (
                    <div key={message.id} className="flex justify-center my-6">
                      <div className="flex items-center w-full max-w-md">
                        <div className="flex-1 h-px bg-white/10"></div>
                        <div className="px-3 py-1 bg-card/80 rounded-full text-xs text-muted-foreground border border-white/10">
                          {message.content}
                        </div>
                        <div className="flex-1 h-px bg-white/10"></div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-healing flex items-center justify-center shadow-healing">
                          <Bot className="h-5 w-5 text-white drop-shadow-sm" />
                        </div>
                      )}
                      
                      <div
                        className={`max-w-[80%] p-4 rounded-2xl ${
                          message.role === "user"
                            ? "bg-gradient-healing text-white shadow-healing"
                            : "bg-card/95 text-foreground border border-white/10 backdrop-blur-sm shadow-healing"
                        }`}
                      >
                        {message.buttonMessage && (
                          <p className="text-sm mb-3 font-medium">{message.buttonMessage}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {message.buttons && message.buttons.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.buttons.map((button) => (
                              <Button
                                key={button.id}
                                variant="outline"
                                size="sm"
                                className="mr-2 mb-2"
                                onClick={() => handleButtonClick(button.id, button.text)}
                                disabled={isLoading}
                              >
                                {button.text}
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        <div className={`text-xs mt-1 ${
                          message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      {message.role === "user" && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-mystical flex items-center justify-center shadow-healing">
                          <User className="h-5 w-5 text-white drop-shadow-sm" />
                        </div>
                      )}
                    </div>
                  )
                ))}
                
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-healing flex items-center justify-center shadow-healing">
                      <Bot className="h-5 w-5 text-white drop-shadow-sm" />
                    </div>
                    <div className="bg-card/95 p-4 rounded-2xl border border-white/10 backdrop-blur-sm shadow-healing">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Pensando com carinho...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input de Mensagem */}
            <div className="border-t border-white/10 p-6 bg-gradient-soft">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Compartilhe seus pensamentos..."
                  disabled={isLoading || !currentSession}
                  className="flex-1 bg-white/50 border-white/30 rounded-xl backdrop-blur-sm focus:bg-white/70 transition-all duration-300"
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading || !currentSession}
                  size="icon"
                  className="bg-gradient-healing hover:shadow-glow transition-all duration-300 rounded-xl w-12 h-12"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popup de Sentimentos */}
      <SentimentosPopup
        isOpen={showSentimentosPopup}
        onClose={() => setShowSentimentosPopup(false)}
        onConfirm={handleSentimentosConfirm}
        context={currentContext}
      />
    </div>
  );
};