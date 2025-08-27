import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Mic, Square, NotebookPen, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SentimentosPopup from "./SentimentosPopup";
import { NotesDialog } from "./NotesDialog";
import { ProtocolExecutor } from "@/components/ProtocolExecutor";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useDraftMessage } from "@/hooks/useDraftMessage";
import { useAudioDraft } from "@/hooks/useAudioDraft";
import { useSessionManager } from "@/hooks/useSessionManager";

interface Message {
  id: string;
  role: "user" | "assistant" | "protocol";
  content: string;
  created_at: string;
  metadata?: any;
}

export const SimplifiedChatNew = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(null);
  const [pendingSessionCreation, setPendingSessionCreation] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [useProtocolMode, setUseProtocolMode] = useState(true);
  const [protocolActive, setProtocolActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { pauseSession, cleanupOrphanedSessions } = useSessionManager();

  const {
    isRecording,
    isProcessing,
    recordingTime,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useVoiceRecording(currentConsultationId);

  const {
    draftContent,
    isDraftSaving,
    hasDraft,
    updateDraft,
    clearDraft,
  } = useDraftMessage(currentConsultationId);

  const { audioDraft, clearAudioDraft } = useAudioDraft(currentConsultationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const urlPath = window.location.pathname;
    const sessionIdFromUrl = urlPath.split('/chat/')[1];
    
    if (sessionIdFromUrl) {
      setCurrentConsultationId(sessionIdFromUrl);
      loadSessionMessages(sessionIdFromUrl);
      
      // Setup automatic session pausing on page unload
      const handleBeforeUnload = () => {
        pauseSession(sessionIdFromUrl);
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Setup inactivity timeout (30 minutes)
      let inactivityTimer: NodeJS.Timeout;
      
      const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          pauseSession(sessionIdFromUrl);
          toast({
            title: "Consulta pausada por inatividade",
            description: "Sua consulta foi pausada automaticamente após 30 minutos de inatividade.",
          });
        }, 30 * 60 * 1000); // 30 minutes
      };
      
      // Reset timer on user activity
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
      });
      
      resetInactivityTimer();
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        clearTimeout(inactivityTimer);
        events.forEach(event => {
          document.removeEventListener(event, resetInactivityTimer, true);
        });
      };
    }
    
    // Clean up orphaned sessions when component loads
    cleanupOrphanedSessions();
  }, [pauseSession, cleanupOrphanedSessions, toast]);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from("session_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      const typedMessages = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant" | "protocol",
        content: msg.content,
        created_at: msg.created_at,
        metadata: (msg as any).metadata
      }));
      setMessages(typedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens da sessão:", error);
    }
  };

  const createNewConsultation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
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

  const startProtocol = async (userMessage: string) => {
    if (!currentConsultationId) return;

    setProtocolActive(true);
    
    // Classificar protocolo
    const { data: classifyResult, error } = await supabase.functions.invoke('protocol-executor', {
      body: {
        sessionId: currentConsultationId,
        action: 'classify_protocol',
        userMessage
      }
    });

    if (error) {
      console.error('Erro ao classificar protocolo:', error);
      setProtocolActive(false);
      return;
    }

    console.log('Protocolo classificado:', classifyResult.protocol);
  };

  const handleProtocolComplete = async (result: any) => {
    if (!currentConsultationId) return;

    console.log('Protocolo completo:', result);
    
    // Se não for protocolo, responder normalmente
    if (result.type === 'no_protocol') {
      setProtocolActive(false);
      // Criar resposta explicativa para mensagens simples
      const helpMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Olá! 👋 Sou seu assistente terapêutico.\n\nPara eu ajudá-lo melhor, me conte sobre um evento específico que você gostaria de processar, como:\n\n• \"Quando perdi meu emprego...\"\n• \"A primeira vez que senti ansiedade...\"\n• \"Quando discuti com minha família...\"\n\nDescreva o que aconteceu e como se sentiu. Estou aqui para ajudar!",
        created_at: new Date().toISOString(),
        metadata: { type: 'help_message' }
      };
      
      setMessages(prev => [...prev, helpMessage]);
      
      // Salvar no banco
      await supabase.from("session_messages").insert({
        session_id: currentConsultationId,
        role: "assistant",
        content: helpMessage.content,
        metadata: helpMessage.metadata
      });
      
      return;
    }
    
    // Protocolo concluído - operação silenciosa
    setProtocolActive(false);
    
    // Gerar título automático da sessão
    try {
      await supabase.functions.invoke('generate-session-title', {
        body: { sessionId: currentConsultationId }
      });
    } catch (error) {
      console.error('Erro ao gerar título:', error);
    }

    // Iniciar geração da biblioteca de áudios em background
    try {
      if (result.sentiments && result.sentiments.length > 0) {
        await supabase.functions.invoke('batch-generate-audio-items', {
          body: {
            sessionId: currentConsultationId,
            sentiments: result.sentiments,
            userId: (await supabase.auth.getUser()).data.user?.id
          }
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar geração de áudios:', error);
    }
    
    // Operação silenciosa - não mostrar resultado na tela
    toast({
      title: "Sessão processada",
      description: "Seus áudios personalizados estão sendo gerados. Você receberá uma notificação quando estiverem prontos.",
    });
  };

  const sendMessage = async (messageText?: string) => {
    const actualMessage = messageText || draftContent || input;
    if (!actualMessage.trim()) return;

    // Criar consulta se necessário
    let consultationId = currentConsultationId;
    if (!consultationId) {
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

      // Atualizar interface
      const newUserMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newUserMessage]);

      // Modo protocolo: iniciar execução
      if (useProtocolMode) {
        await startProtocol(userMessage);
      }
      
      clearDraft();
      clearAudioDraft();

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

  const pauseCurrentConsultation = async () => {
    if (!currentConsultationId) return;

    try {
      const { error } = await supabase.rpc('pause_consultation', {
        consultation_uuid: currentConsultationId
      });

      if (error) throw error;

      setCurrentConsultationId(null);
      setMessages([]);
      
      toast({
        title: "Consulta pausada",
        description: "Você pode retomá-la na tela inicial.",
      });

      window.location.href = '/';
    } catch (error) {
      console.error("Erro ao pausar consulta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível pausar a consulta.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Messages area */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-144px)]">
          <div className="p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-4 sm:py-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 bg-primary rounded-full flex items-center justify-center">
                  <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                </div>
                <p className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-primary">
                  Bem-vindo ao MyHealing Chat
                </p>
                <p className="text-xs sm:text-sm max-w-xs sm:max-w-md mx-auto leading-relaxed px-4">
                  Conte-me sobre um evento específico que você gostaria de processar.
                </p>
              </div>
            )}
            
            {messages.map((message) => (
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
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  
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
            ))}
            
            {/* Protocol Executor */}
            {protocolActive && currentConsultationId && (
              <div className="flex gap-2 sm:gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                </div>
                <div className="max-w-[85%] sm:max-w-[80%]">
                  <ProtocolExecutor
                    sessionId={currentConsultationId}
                    userMessage={messages[messages.length - 1]?.content || ""}
                    onComplete={handleProtocolComplete}
                  />
                </div>
              </div>
            )}
            
            {isLoading && !protocolActive && (
              <div className="flex gap-2 sm:gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                </div>
                <div className="bg-muted p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-primary" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Iniciando protocolo...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-background p-2 sm:p-3 border-t border-border/20">
        <Card className="bg-card border-border shadow-sm rounded-xl sm:rounded-2xl">
          <CardContent className="p-2 sm:p-3">
            {(hasDraft || audioDraft) && (
              <div className="mb-2 text-xs text-muted-foreground/60 flex items-center gap-2">
                {hasDraft && <span>📝</span>}
                {audioDraft && <span>🎤</span>}
              </div>
            )}
            
            <div className="flex flex-wrap gap-1 sm:gap-2">
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setNotesDialogOpen(true)}
                  className="h-8 px-2 text-xs"
                  title="Minhas anotações"
                >
                  <NotebookPen className="h-3 w-3" />
                </Button>
                {currentConsultationId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={pauseCurrentConsultation}
                    className="h-8 px-2 text-xs"
                    title="Pausar consulta"
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex-1 flex gap-1 sm:gap-2 min-w-0">
                <Input
                  value={draftContent || input}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInput(value);
                    updateDraft(value);
                    
                    if (value.trim() && !currentConsultationId && !pendingSessionCreation) {
                      setPendingSessionCreation(true);
                      createNewConsultation().then((sessionId) => {
                        if (sessionId) {
                          setCurrentConsultationId(sessionId);
                        }
                        setPendingSessionCreation(false);
                      });
                    }
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={hasDraft ? "Continuando seu rascunho..." : audioDraft ? "Há um áudio pausado" : "Conte sobre um evento específico..."}
                  disabled={isLoading || isRecording || isProcessing || protocolActive}
                  className="flex-1 border-primary/30 focus:border-primary h-10 sm:h-11 text-sm"
                />
                
                {isRecording && !isPaused && (
                  <Button 
                    onClick={pauseRecording}
                    disabled={isLoading || isProcessing}
                    variant="outline"
                    size="icon"
                    className="h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                
                {isPaused && (
                  <Button 
                    onClick={resumeRecording}
                    disabled={isLoading || isProcessing}
                    variant="outline"
                    size="icon"
                    className="h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                
                <Button 
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={isLoading || isProcessing || protocolActive}
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  className="h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
                >
                  {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                
                <Button 
                  onClick={() => sendMessage()} 
                  disabled={isLoading || !(draftContent || input).trim() || (isRecording && !isPaused) || isProcessing || protocolActive}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 sm:h-11 w-10 sm:w-11 flex-shrink-0"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          
            {/* Status indicators */}
            {isRecording && !isPaused && (
              <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                Gravando... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
            )}
            
            {isPaused && (
              <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                Gravação pausada - salva como rascunho
              </div>
            )}
            
            {isDraftSaving && (
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                Salvando rascunho...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NotesDialog 
        open={notesDialogOpen} 
        onOpenChange={setNotesDialogOpen}
      />
    </div>
  );
};