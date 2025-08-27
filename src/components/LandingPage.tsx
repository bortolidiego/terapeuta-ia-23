import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Clock, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PendingConsultations } from "./PendingConsultations";
import { AudioPlayer } from "./AudioPlayer";
import { useSessionManager } from "@/hooks/useSessionManager";

export const LandingPage = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { findActiveSession, cleanupOrphanedSessions } = useSessionManager();

  useEffect(() => {
    fetchPendingCount();
    checkForActiveSession();
    cleanupOrphanedSessions();
  }, [cleanupOrphanedSessions]);

  const checkForActiveSession = async () => {
    try {
      const activeSession = await findActiveSession();
      if (activeSession && activeSession.hasRecentMessages) {
        toast({
          title: "Consulta ativa encontrada",
          description: "Você será redirecionado para sua consulta em andamento.",
        });
        navigate(`/chat/${activeSession.id}`);
      }
    } catch (error) {
      console.error("Erro ao verificar sessão ativa:", error);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from("therapy_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "paused");

      if (error) throw error;
      setPendingCount(count || 0);
    } catch (error) {
      console.error("Erro ao buscar consultas pendentes:", error);
    }
  };

  const createNewConsultation = async () => {
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Check if there's already an active session with recent activity
      const activeSession = await findActiveSession();
      if (activeSession && activeSession.hasRecentMessages) {
        toast({
          title: "Consulta ativa encontrada",
          description: "Você será redirecionado para sua consulta em andamento.",
        });
        navigate(`/chat/${activeSession.id}`);
        return;
      }

      const { data: session, error } = await supabase
        .from("therapy_sessions")
        .insert({
          user_id: user.id,
          title: "Nova Consulta",
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Nova consulta iniciada",
        description: "Você pode começar a conversar agora.",
      });

      navigate(`/chat/${session.id}`);
    } catch (error) {
      console.error("Erro ao criar consulta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar uma nova consulta",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (showPending) {
    return (
      <PendingConsultations 
        onBack={() => {
          setShowPending(false);
          fetchPendingCount(); // Atualiza a contagem quando volta
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 space-y-6">
      {/* Header with Actions */}
      <div className="w-full max-w-6xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="text-center space-y-2 mb-8">
              <MessageCircle className="h-16 w-16 mx-auto text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                Terapia Virtual
              </h1>
              <p className="text-muted-foreground">
                Inicie uma nova consulta ou continue uma consulta pausada
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Button
                onClick={createNewConsultation}
                disabled={isCreating}
                className="h-12 text-lg font-semibold"
                size="lg"
              >
                <Play className="mr-2 h-5 w-5" />
                {isCreating ? "Iniciando..." : "Iniciar Consulta"}
              </Button>

              <Button
                onClick={() => setShowPending(true)}
                variant="outline"
                className="h-12 text-lg relative"
                size="lg"
              >
                <Clock className="mr-2 h-5 w-5" />
                Consultas Pendentes
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center font-semibold">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audio Player Section */}
      <div className="w-full max-w-6xl mx-auto">
        <AudioPlayer className="shadow-lg" />
      </div>
    </div>
  );
};