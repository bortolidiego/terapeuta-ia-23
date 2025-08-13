import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Play, Clock, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface PendingConsultation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface PendingConsultationsProps {
  onBack: () => void;
}

export const PendingConsultations = ({ onBack }: PendingConsultationsProps) => {
  const [consultations, setConsultations] = useState<PendingConsultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPendingConsultations();
  }, []);

  const loadPendingConsultations = async () => {
    try {
      const { data, error } = await supabase
        .from("therapy_sessions")
        .select("id, title, created_at, updated_at")
        .eq("status", "paused")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConsultations(data || []);
    } catch (error) {
      console.error("Erro ao carregar consultas pendentes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as consultas pendentes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resumeConsultation = async (consultationId: string) => {
    try {
      const { error } = await supabase
        .from("therapy_sessions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", consultationId);

      if (error) throw error;

      toast({
        title: "Consulta retomada",
        description: "Você pode continuar de onde parou.",
      });

      navigate(`/chat/${consultationId}`);
    } catch (error) {
      console.error("Erro ao retomar consulta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível retomar a consulta",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-xl">Consultas Pendentes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Retome suas consultas pausadas
              </p>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : consultations.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma consulta pendente encontrada
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {consultations.map((consultation) => (
                    <Card key={consultation.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="h-4 w-4 text-primary" />
                              <h3 className="font-medium">{consultation.title}</h3>
                              <Badge variant="secondary" className="text-xs">
                                Pausada
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Pausada em: {formatDate(consultation.updated_at)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Criada em: {formatDate(consultation.created_at)}
                            </p>
                          </div>
                          <Button
                            onClick={() => resumeConsultation(consultation.id)}
                            size="sm"
                            className="ml-4"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Continuar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};