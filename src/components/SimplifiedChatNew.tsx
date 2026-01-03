import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
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
import { InteractiveChatForm } from "@/components/InteractiveChatForm";
import { AudioAssemblyNotification } from "@/components/AudioAssemblyNotification";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useDraftMessage } from "@/hooks/useDraftMessage";
import { useAudioDraft } from "@/hooks/useAudioDraft";
import { useAudioAssembly } from "@/hooks/useAudioAssembly";
import { useSessionManager } from "@/hooks/useSessionManager";

interface Message {
  id: string;
  role: "user" | "assistant" | "protocol";
  content: string;
  created_at: string;
  metadata?: any;
}

export const SimplifiedChatNew = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(null);
  const [pendingSessionCreation, setPendingSessionCreation] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [useProtocolMode, setUseProtocolMode] = useState(true);
  const [protocolActive, setProtocolActive] = useState(false);
  const [userInitials, setUserInitials] = useState("U");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { pauseSession, cleanupOrphanedSessions } = useSessionManager();

  // Fetch user profile for initials
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Buscar full_name da tabela user_profiles
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            console.error('Error fetching user profile:', error);
            return;
          }

          const fullName = (profile as any)?.full_name;
          if (fullName && typeof fullName === 'string') {
            const names = fullName.trim().split(' ');
            const initials = names.length >= 2
              ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
              : names[0].substring(0, 2).toUpperCase();
            setUserInitials(initials);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile for initials:', error);
      }
    };
    fetchUserProfile();
  }, []);

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

  const { startAudioAssembly } = useAudioAssembly(currentConsultationId);

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
      checkActiveProtocol(sessionIdFromUrl);

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

  // Pausar sessão automaticamente quando sair do chat
  useEffect(() => {
    const sessionId = id || currentConsultationId;

    return () => {
      // Componente está sendo desmontado - pausar a sessão
      if (sessionId) {
        console.log('Saindo do chat, pausando sessão:', sessionId);
        pauseSession(sessionId, true).catch(console.error);
      }
    };
  }, [id, currentConsultationId, pauseSession]);

  const checkActiveProtocol = async (sessionId: string) => {
    try {
      const { data: activeProtocol, error } = await supabase
        .from('session_protocols')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (activeProtocol) {
        console.log('Protocolo ativo encontrado, ativando protocolo:', activeProtocol);
        setProtocolActive(true);

        // Mostrar feedback de continuação
        toast({
          title: "Protocolo retomado",
          description: "Continuando de onde você parou na seleção de sentimentos.",
        });
      }
    } catch (error) {
      console.error('Erro ao verificar protocolo ativo:', error);
    }
  };

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

      // Deduplicar mensagens (mesmo conteúdo e role num intervalo de 10s)
      const uniqueMessages = typedMessages.filter((msg, index, self) =>
        index === self.findIndex((m) => (
          m.role === msg.role &&
          m.content === msg.content &&
          Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 10000
        ))
      );

      setMessages(uniqueMessages);
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

  // Gerar título resumido a partir da primeira mensagem do usuário
  const updateSessionTitle = async (sessionId: string, userMessage: string) => {
    try {
      // Criar título a partir da mensagem (max 50 chars)
      let title = userMessage.trim();

      // Remover prefixos comuns de conversa
      const prefixesToRemove = [
        'quero tratar',
        'preciso de ajuda com',
        'estou tendo problemas com',
        'eu tenho',
        'eu estou',
        'me sinto',
      ];

      for (const prefix of prefixesToRemove) {
        if (title.toLowerCase().startsWith(prefix)) {
          title = title.substring(prefix.length).trim();
          break;
        }
      }

      // Capitalizar primeira letra
      title = title.charAt(0).toUpperCase() + title.slice(1);

      // Truncar se muito longo
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      // Atualizar no banco
      await supabase
        .from('therapy_sessions')
        .update({ title })
        .eq('id', sessionId);

      console.log('Título da sessão atualizado para:', title);
    } catch (error) {
      console.error('Erro ao atualizar título da sessão:', error);
    }
  };

  const startProtocol = async (userMessage: string) => {
    if (!currentConsultationId) return;

    try {
      // Chamar therapy-chat com Gemini Flash 3.0 e metodologia completa
      const { data: chatResponse, error } = await supabase.functions.invoke('therapy-chat', {
        body: {
          message: userMessage,
          sessionId: currentConsultationId,
          history: messages.filter(m => m.role !== "protocol").map(m => ({
            role: m.role,
            content: m.content
          })),
          userId: (await supabase.auth.getUser()).data.user?.id
        }
      });

      if (error) {
        console.error('Erro ao chamar therapy-chat:', error);
        throw error;
      }

      console.log('Resposta therapy-chat:', chatResponse);

      // Verificar se detectou um protocolo
      const detectedProtocol = chatResponse.detectedProtocol;

      // Limpar marcadores de popup da resposta para exibição
      const cleanReply = chatResponse.reply
        .replace(/\[POPUP:sentimentos\]/g, '')
        .replace(/\[POPUP:.*?\]/g, '')
        .trim();

      // Verificar se a resposta contém popup de sentimentos
      const hasSentimentPopup = chatResponse.reply.includes('[POPUP:sentimentos]');

      // Sempre mostrar a resposta do terapeuta primeiro (se houver conteúdo)
      if (cleanReply) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: cleanReply,
          created_at: new Date().toISOString(),
          metadata: {
            detectedProtocol,
            model: chatResponse.model
          }
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Salvar no banco
        await supabase.from("session_messages").insert({
          session_id: currentConsultationId,
          role: "assistant",
          content: cleanReply,
          metadata: { detectedProtocol, model: chatResponse.model }
        });
      }

      // Se tem popup de sentimentos, ativar o protocolo
      if (hasSentimentPopup) {
        console.log('Ativando popup de sentimentos');
        setProtocolActive(true);
        return;
      }

      // Se detectou protocolo (sem popup), ativar ProtocolExecutor
      if (detectedProtocol && detectedProtocol !== 'none') {
        console.log('Ativando protocolo:', detectedProtocol);
        setProtocolActive(true);
      }

    } catch (error) {
      console.error('Erro no therapy-chat:', error);

      // Fallback: mostrar mensagem genérica
      const fallbackMessage: Message = {
        id: `fallback-${Date.now()}`,
        role: "assistant",
        content: "Desculpe, tive um problema técnico. Pode repetir o que você disse?",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    }
  };

  const handleProtocolComplete = async (result: any) => {
    console.log('Protocol completed:', result);
    setIsLoading(false);
    setProtocolActive(false);

    try {
      if (result.type === 'assembly_instructions') {
        const { assemblyInstructions, ready, optimized } = result;

        if (ready) {
          // OTIMIZAÇÃO: Iniciar montagem de áudio EM BACKGROUND
          const jobId = await startAudioAssembly(assemblyInstructions);
          console.log('Optimized audio assembly started with job ID:', jobId);

          // CONTINUIDADE CONVERSACIONAL: Dr. Healing não para de conversar
          const continuationMessage = {
            id: `protocol-continuation-${Date.now()}`,
            role: 'assistant' as const,
            content: `🎯 **Sua Autocura Personalizada Foi Iniciada**

Perfeito! Acabei de começar a preparar sua autocura com os ${assemblyInstructions.originalSentimentCount || assemblyInstructions.selectedSentiments?.length || 0} sentimentos que você selecionou.

${optimized ? `✨ **Protocolo Otimizado**: Reduzi para ${assemblyInstructions.selectedSentiments?.length} sentimentos principais para acelerar o processo.` : ''}

⏱️ **Tempo estimado**: ${Math.round((assemblyInstructions.estimatedDuration || 0) / 60)} minutos
🔄 **Status**: Processando em segundo plano

**Enquanto sua autocura é preparada, vamos continuar nossa conversa...**

Como você imagina que se sentirá depois de liberar esses sentimentos que carrega? Às vezes é importante visualizar o estado que queremos alcançar.

*Você receberá notificações do progresso e será avisado assim que sua autocura estiver pronta para ser ouvida.*`,
            created_at: new Date().toISOString(),
            metadata: {
              type: 'protocol_continuation',
              jobId,
              assemblyInstructions: assemblyInstructions,
              optimized: optimized || false
            }
          };

          setMessages(prev => [...prev, continuationMessage]);

          // FEEDBACK OTIMIZADO: Toast menos intrusivo
          toast({
            title: '🎯 Autocura Iniciada',
            description: `Protocolo ${optimized ? 'otimizado ' : ''}em execução. Continue a conversa!`,
          });
        } else {
          // Componentes não disponíveis
          const errorMessage = {
            id: `protocol-error-${Date.now()}`,
            role: 'assistant' as const,
            content: `❌ **Componentes Temporariamente Indisponíveis**

Alguns fragmentos de áudio não estão prontos no momento:
${result.unavailableComponents?.join(', ')}

Isso é temporário! Vamos tentar uma abordagem alternativa ou aguardar alguns minutos.

Enquanto isso, conte-me mais sobre como esses sentimentos se manifestam no seu dia a dia. Isso me ajudará a personalizar ainda mais sua autocura quando os componentes estiverem disponíveis.`,
            created_at: new Date().toISOString(),
            metadata: { type: 'protocol_error' }
          };

          setMessages(prev => [...prev, errorMessage]);

          toast({
            title: 'Componentes Temporariamente Indisponíveis',
            description: 'Continuando conversa enquanto aguardamos disponibilidade.',
            variant: 'destructive',
          });
        }
      } else if (result.type === 'no_protocol') {
        // Chatbot já conversou, não precisamos de mensagem genérica aqui.
        console.log('No protocol needed, continuing chat (suppressed generic message)');

        /* CÓDIGO SUPRIMIDO PARA EVITAR MENSAGEM DUPLICADA
        const helpMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: "Entendo. Como posso ajudá-lo hoje? Me conte sobre um evento específico que você gostaria de processar, ou simplesmente compartilhe o que está em sua mente no momento.",
          created_at: new Date().toISOString(),
          metadata: { type: 'help_message' }
        };

        setMessages(prev => [...prev, helpMessage]);

        if (currentConsultationId) {
          await supabase.from("session_messages").insert({
            session_id: currentConsultationId,
            role: "assistant",
            content: helpMessage.content,
            metadata: helpMessage.metadata
          });
        }
        */
      } else if (result.type === 'cancelled') {
        // Protocolo cancelado pelo usuário
        console.log('Protocol cancelled by user');
        // O toast já foi exibido pelo ProtocolExecutor, apenas resetar o estado
      }
    } catch (error) {
      console.error('Erro ao processar resultado do protocolo:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: `❌ **Erro Temporário**

Houve um problema ao iniciar o protocolo, mas não se preocupe - podemos tentar novamente.

Enquanto isso, gostaria de conversar sobre o que você está passando? Às vezes, apenas expressar nossos sentimentos já é um primeiro passo importante para a cura.`,
        created_at: new Date().toISOString(),
        metadata: { type: 'error' }
      }]);

      toast({
        title: 'Erro Temporário',
        description: 'Continuando conversa. Podemos tentar o protocolo novamente.',
        variant: 'destructive',
      });
    }
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

      // Atualizar título da sessão se é a primeira mensagem
      if (messages.length === 0) {
        updateSessionTitle(consultationId, userMessage);
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

  const handleFormSubmit = (answers: string[], questions: string[]) => {
    // Formatar respostas para enviar como mensagem
    const formattedResponse = questions.map((q, i) => `**${q}**\n${answers[i] || 'Sem resposta'}`).join('\n\n');
    sendMessage(formattedResponse);
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
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-lg shadow-teal-500/30">
                  <span className="text-lg sm:text-2xl font-bold text-white drop-shadow-sm">DM</span>
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
                className={`flex gap-2 sm:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-md shadow-teal-500/20">
                    <span className="text-xs sm:text-sm font-bold text-white">DM</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl sm:rounded-2xl ${message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground border border-border"
                    }`}
                >
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {(() => {
                      // Verificar se há formulário interativo
                      // Suporta fechamento opcional [/FORMULARIO] para separar rodapé
                      const formRegex = /\[FORMULARIO\](.*?)(\[\/FORMULARIO\]|$)/s;
                      const match = message.content.match(formRegex);

                      if (match && message.role === 'assistant') {
                        const introText = message.content.substring(0, match.index).trim();
                        let questionsStr = match[1];
                        let footerText = message.content.substring(match.index + match[0].length).trim();

                        // Heurística: Se não tem tag de fechamento e a última parte parece ter um rodapé (texto após quebra de linha que não é pergunta)
                        if (!match[2].includes('[/FORMULARIO]')) {
                          const parts = questionsStr.split('|');
                          const lastPart = parts[parts.length - 1];
                          const splitLast = lastPart.split(/\n\n+/);

                          if (splitLast.length > 1) {
                            const potentialFooter = splitLast[splitLast.length - 1].trim();
                            // Se o potencial rodapé não termina com ? e tem tamanho razoável, assumimos que é texto de encerramento
                            if (!potentialFooter.endsWith('?') && potentialFooter.length > 5) {
                              footerText = potentialFooter;
                              // Remove o rodapé da string de questões
                              questionsStr = questionsStr.substring(0, questionsStr.lastIndexOf(potentialFooter)).trim();
                            }
                          }
                        }

                        const questions = questionsStr.split('|').map(q => q.trim()).filter(q => q);

                        return (
                          <>
                            {introText && <p className="mb-4">{introText}</p>}
                            <InteractiveChatForm
                              questions={questions}
                              onSubmit={(answers) => handleFormSubmit(answers, questions)}
                              isSubmitting={isLoading}
                            />
                            {footerText && <p className="mt-4 text-muted-foreground italic">{footerText}</p>}
                          </>
                        );
                      }

                      return message.content;
                    })()}
                  </div>

                  {message.content.includes("Mapa Astral ainda não está configurado") && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => navigate('/profile')}
                        className="bg-purple-600 hover:bg-purple-700 text-white border-none text-xs"
                      >
                        <User className="mr-2 h-3 w-3" />
                        Configurar meu Mapa Astral agora
                      </Button>
                    </div>
                  )}

                  <div className={`text-xs mt-1 sm:mt-2 ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}>
                    {new Date(message.created_at).toLocaleTimeString()}
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <span className="text-xs sm:text-sm font-bold text-white">{userInitials}</span>
                  </div>
                )}
              </div>
            ))}

            {/* Protocol Executor */}
            {protocolActive && currentConsultationId && (
              <div className="flex gap-2 sm:gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-md shadow-teal-500/20">
                  <span className="text-xs sm:text-sm font-bold text-white">DM</span>
                </div>
                <div className="max-w-[85%] sm:max-w-[80%]">
                  <ProtocolExecutor
                    sessionId={currentConsultationId}
                    userMessage={messages.filter(m => m.role === 'user').pop()?.content || ""}
                    onComplete={handleProtocolComplete}
                  />
                </div>
              </div>
            )}

            {/* Audio Assembly Notification */}
            {currentConsultationId && (
              <AudioAssemblyNotification
                sessionId={currentConsultationId}
                onAudioReady={(audioUrl) => {
                  // Adicionar mensagem com link do áudio quando pronto
                  const audioMessage = {
                    id: `audio-ready-${Date.now()}`,
                    role: 'assistant' as const,
                    content: `🎉 **Sua Autocura Está Pronta!**\n\nSeu áudio personalizado foi criado com sucesso. Clique abaixo para ouvir:\n\n[AUDIO:${audioUrl}]`,
                    created_at: new Date().toISOString(),
                    metadata: { type: 'audio_ready', audioUrl }
                  };
                  setMessages(prev => [...prev, audioMessage]);
                }}
              />
            )}

            {isLoading && !protocolActive && (
              <div className="flex gap-2 sm:gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-md shadow-teal-500/20 animate-pulse">
                  <span className="text-xs sm:text-sm font-bold text-white">DM</span>
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