import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  Zap, 
  Sparkles, 
  TrendingUp, 
  Calendar,
  DollarSign,
  AlertTriangle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Credits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [credits, setCredits] = useState<any>({});
  const [usage, setUsage] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadCreditsData();
  }, [user, navigate]);

  const loadCreditsData = async () => {
    setIsLoading(true);
    try {
      // Buscar créditos atuais
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      setCredits(creditsData || {});

      // Buscar histórico de uso (últimos 30 dias)
      const { data: usageData } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      setUsage(usageData || []);
    } catch (error) {
      console.error('Erro ao carregar dados de créditos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de créditos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseCredits = async (type: 'openai' | 'elevenlabs', amount: number) => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A compra de créditos será implementada em breve",
    });
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'openai':
        return <Sparkles className="h-4 w-4" />;
      case 'elevenlabs':
        return <Zap className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'chat_completion':
        return 'Chat Terapêutico';
      case 'text_to_speech':
        return 'Geração de Áudio';
      case 'voice_cloning':
        return 'Clonagem de Voz';
      case 'title_generation':
        return 'Título de Sessão';
      default:
        return operation;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const openaiPercent = Math.min((credits.openai_credits || 0) / 1000 * 100, 100);
  const elevenlabsPercent = Math.min((credits.elevenlabs_credits || 0) / 500 * 100, 100);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Créditos</h1>
          <p className="text-muted-foreground">Gerencie seus créditos e acompanhe o uso dos serviços</p>
        </div>

        {/* Status dos Créditos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* OpenAI Credits */}
          <Card className={openaiPercent < 20 ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                OpenAI Credits
                {openaiPercent < 20 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </CardTitle>
              <CardDescription>Para chat terapêutico e análises</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-primary">
                {credits.openai_credits || 0}
              </div>
              <Progress value={openaiPercent} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Gasto total: ${(credits.total_spent_openai || 0).toFixed(2)}</span>
                <span>{openaiPercent.toFixed(0)}%</span>
              </div>
              <Button 
                onClick={() => purchaseCredits('openai', 1000)}
                variant={openaiPercent < 20 ? "default" : "outline"}
                className="w-full"
              >
                Comprar Créditos OpenAI
              </Button>
            </CardContent>
          </Card>

          {/* ElevenLabs Credits */}
          <Card className={elevenlabsPercent < 20 ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-secondary" />
                ElevenLabs Credits
                {elevenlabsPercent < 20 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </CardTitle>
              <CardDescription>Para clonagem de voz e áudios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-secondary">
                {credits.elevenlabs_credits || 0}
              </div>
              <Progress value={elevenlabsPercent} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Gasto total: ${(credits.total_spent_elevenlabs || 0).toFixed(2)}</span>
                <span>{elevenlabsPercent.toFixed(0)}%</span>
              </div>
              <Button 
                onClick={() => purchaseCredits('elevenlabs', 500)}
                variant={elevenlabsPercent < 20 ? "default" : "outline"}
                className="w-full"
              >
                Comprar Créditos ElevenLabs
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Pacotes de Créditos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pacotes de Créditos
            </CardTitle>
            <CardDescription>Escolha o melhor pacote para suas necessidades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pacote Básico */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="text-center">
                  <h3 className="font-semibold">Básico</h3>
                  <p className="text-2xl font-bold text-primary">R$ 29</p>
                  <p className="text-sm text-muted-foreground">por mês</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li>✓ 500 créditos OpenAI</li>
                  <li>✓ 250 créditos ElevenLabs</li>
                  <li>✓ 10 sessões de terapia</li>
                  <li>✓ Clonagem de voz</li>
                </ul>
                <Button variant="outline" className="w-full">Escolher Básico</Button>
              </div>

              {/* Pacote Premium */}
              <div className="p-4 border-2 border-primary rounded-lg space-y-3 relative">
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">Mais Popular</Badge>
                <div className="text-center">
                  <h3 className="font-semibold">Premium</h3>
                  <p className="text-2xl font-bold text-primary">R$ 79</p>
                  <p className="text-sm text-muted-foreground">por mês</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li>✓ 1500 créditos OpenAI</li>
                  <li>✓ 750 créditos ElevenLabs</li>
                  <li>✓ 30 sessões de terapia</li>
                  <li>✓ Clonagem de voz premium</li>
                  <li>✓ Suporte prioritário</li>
                </ul>
                <Button className="w-full">Escolher Premium</Button>
              </div>

              {/* Pacote Pro */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="text-center">
                  <h3 className="font-semibold">Pro</h3>
                  <p className="text-2xl font-bold text-primary">R$ 149</p>
                  <p className="text-sm text-muted-foreground">por mês</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li>✓ 3000 créditos OpenAI</li>
                  <li>✓ 1500 créditos ElevenLabs</li>
                  <li>✓ Sessões ilimitadas</li>
                  <li>✓ Múltiplas vozes clonadas</li>
                  <li>✓ API access</li>
                </ul>
                <Button variant="outline" className="w-full">Escolher Pro</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Uso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Histórico de Uso (Últimos 30 dias)
            </CardTitle>
            <CardDescription>Acompanhe como seus créditos estão sendo utilizados</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum uso registrado nos últimos 30 dias
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {usage.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getServiceIcon(item.service)}
                      <div>
                        <p className="font-medium text-sm">{getOperationLabel(item.operation_type)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <DollarSign className="h-3 w-3" />
                        {item.cost_usd.toFixed(3)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.tokens_used} tokens
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};