import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Settings, Power } from "lucide-react";
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
}

export const SimplifiedChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSentimentosPopup, setShowSentimentosPopup] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [currentContext, setCurrentContext] = useState<string>("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
        role: msg.role as "user" | "assistant" | "session_end",
        content: msg.content,
        created_at: msg.created_at
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
        .insert({ title: `Sessão ${new Date().toLocaleString()}` })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentSessionId(data.id);
      return data.id;
    } catch (error) {
      console.error("Erro ao criar sessão:", error);
      return null;
    }
  };

  const endCurrentSession = async () => {
    if (!currentSessionId) return;

    try {
      // Inserir marcador de fim de sessão
      const sessionEndMessage = {
        session_id: currentSessionId,
        role: "session_end",
        content: `Sessão encerrada em ${new Date().toLocaleString()}`,
      };

      const { error } = await supabase
        .from("session_messages")
        .insert(sessionEndMessage);

      if (error) throw error;

      // Atualizar estado local
      const newEndMessage: Message = {
        id: Date.now().toString(),
        role: "session_end",
        content: sessionEndMessage.content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newEndMessage]);

      setCurrentSessionId(null);
      toast({
        title: "Sessão encerrada",
        description: "Uma nova sessão será iniciada na próxima mensagem.",
      });
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const actualMessage = messageText || input;
    if (!actualMessage.trim()) return;

    // Se não há sessão ativa, criar uma nova
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) return;
      setCurrentSessionId(sessionId);
    }

    const userMessage = actualMessage;
    setInput("");
    setIsLoading(true);

    try {
      // Salvar mensagem do usuário
      const { error: userError } = await supabase
        .from("session_messages")
        .insert({
          session_id: sessionId,
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
            sessionId: sessionId,
            history: messages.filter(m => m.role !== "session_end"),
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
          session_id: sessionId,
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
    // Detectar formato JSON
    const jsonMatch = content.match(/```json\s*(\{[^`]+\})\s*```/);
    if (jsonMatch) {
      try {
        const buttonData = JSON.parse(jsonMatch[1]);
        if (buttonData.type === "buttons" && buttonData.options) {
          return {
            content: content.replace(/```json\s*\{[^`]+\}\s*```/, '').trim(),
            buttons: buttonData.options,
            buttonMessage: buttonData.message || ""
          };
        }
      } catch (e) {
        console.warn("Erro ao processar JSON de botões:", e);
      }
    }

    // Detectar formato Markdown [BTN:id:text]
    const markdownButtons = content.match(/\[BTN:([^:]+):([^\]]+)\]/g);
    if (markdownButtons) {
      const buttons = markdownButtons.map(btn => {
        const match = btn.match(/\[BTN:([^:]+):([^\]]+)\]/);
        return match ? { id: match[1], text: match[2] } : null;
      }).filter(Boolean);

      if (buttons.length > 0) {
        return {
          content: content.replace(/\[BTN:[^:]+:[^\]]+\]/g, '').trim(),
          buttons: buttons as Array<{id: string; text: string}>,
          buttonMessage: ""
        };
      }
    }

    return { content, buttons: undefined, buttonMessage: undefined };
  };

  const handleButtonClick = (buttonId: string, buttonText: string) => {
    sendMessage(buttonId);
  };

  const handleSentimentosConfirm = async (sentimentos: string[]) => {
    setShowSentimentosPopup(false);
    
    // Criar mensagem com os sentimentos selecionados
    const sentimentosMessage = `Sentimentos selecionados: ${sentimentos.join(', ')}`;
    
    // Continuar o processamento com a resposta pendente
    if (pendingResponse && currentSessionId) {
      try {
        // Salvar resposta do assistente com a mensagem pendente
        const { error: assistantError } = await supabase
          .from("session_messages")
          .insert({
            session_id: currentSessionId,
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
            {currentSessionId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={endCurrentSession}
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
                  if (message.role === "session_end") {
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
                disabled={isLoading}
                className="flex-1 border-primary/30 focus:border-primary h-10 sm:h-11 text-sm"
              />
              <Button 
                onClick={() => sendMessage()} 
                disabled={isLoading || !input.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SentimentosPopup
        isOpen={showSentimentosPopup}
        onClose={() => setShowSentimentosPopup(false)}
        onConfirm={handleSentimentosConfirm}
        context={currentContext}
      />
    </div>
  );
};