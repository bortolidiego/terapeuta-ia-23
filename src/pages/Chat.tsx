import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SimplifiedChat } from "@/components/SimplifiedChat";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const Chat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    validateSession();
  }, [id]);

  const validateSession = async () => {
    if (!id) {
      setIsValidating(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("therapy_sessions")
        .select("id, status")
        .eq("id", id)
        .eq("status", "active")
        .single();

      if (error || !data) {
        toast({
          title: "Consulta não encontrada",
          description: "Redirecionando para a tela inicial...",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
    } catch (error) {
      console.error("Erro ao validar sessão:", error);
      navigate("/");
    } finally {
      setIsValidating(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <SimplifiedChat />;
};