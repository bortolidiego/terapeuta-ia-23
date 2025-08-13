import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Clock, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PendingConsultations } from "./PendingConsultations";

export const LandingPage = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
      <PendingConsultations onBack={() => setShowPending(false)} />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <MessageCircle className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              Terapia Virtual
            </h1>
            <p className="text-muted-foreground">
              Inicie uma nova consulta ou continue uma consulta pausada
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={createNewConsultation}
              disabled={isCreating}
              className="w-full h-12 text-lg font-semibold"
              size="lg"
            >
              <Play className="mr-2 h-5 w-5" />
              {isCreating ? "Iniciando..." : "Iniciar Consulta"}
            </Button>

            <Button
              onClick={() => setShowPending(true)}
              variant="outline"
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Clock className="mr-2 h-5 w-5" />
              Consultas Pendentes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};