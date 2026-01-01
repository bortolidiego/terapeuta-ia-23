import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Zap,
  Sparkles,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertTriangle,
  Mic,
  Brain,
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UsageItem {
  id: string;
  service: string;
  operation_type: string;
  tokens_used?: number;
  cost_usd: number;
  created_at: string;
  credits_used?: number;
  cached?: boolean;
}

interface CacheStats {
  totalFragments: number;
  estimatedSavings: number;
}

export const Credits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [credits, setCredits] = useState<any>({});
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats>({ totalFragments: 0, estimatedSavings: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'llm' | 'voice'>('all');

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
        .limit(100);

      setUsage(usageData || []);

      // Buscar estatísticas de cache (tabela pode não existir nos tipos)
      try {
        const result = await (supabase as any)
          .from('audio_fragments_cache')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id);

        const cacheCount = result?.count || 0;
        // Estimativa de economia: cada fragmento cacheado = ~$0.01 economizado
        setCacheStats({
          totalFragments: cacheCount,
          estimatedSavings: cacheCount * 0.01
        });
      } catch {
        setCacheStats({ totalFragments: 0, estimatedSavings: 0 });
      }

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

  const purchaseCredits = async (type: 'llm' | 'voice', amount: number) => {
    toast({
      title: "Em breve!",
      description: "Integração com Asaas em desenvolvimento. Você poderá comprar créditos via PIX, cartão ou boleto.",
    });
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'openai':
      case 'openrouter':
      case 'llm':
        return <Brain className="h-4 w-4 text-purple-500" />;
      case 'elevenlabs':
      case 'voicekiller':
      case 'voice':
        return <Mic className="h-4 w-4 text-blue-500" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getServiceLabel = (service: string) => {
    switch (service) {
      case 'openai':
      case 'openrouter':
        return 'OpenRouter';
      case 'elevenlabs':
      case 'voicekiller':
        return 'VoiceKiller';
      default:
        return service;
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
      case 'sentiment_generation':
        return 'Geração de Sentimentos';
      case 'protocol_classification':
        return 'Classificação de Protocolo';
      default:
        return operation;
    }
  };

  const getServiceType = (service: string): 'llm' | 'voice' => {
    if (['openai', 'openrouter', 'llm'].includes(service)) return 'llm';
    return 'voice';
  };

  // Filtrar uso por tipo
  const filteredUsage = useMemo(() => {
    if (activeFilter === 'all') return usage;
    return usage.filter(item => getServiceType(item.service) === activeFilter);
  }, [usage, activeFilter]);

  // Calcular totais por tipo
  const usageByType = useMemo(() => {
    const llm = usage.filter(u => getServiceType(u.service) === 'llm');
    const voice = usage.filter(u => getServiceType(u.service) === 'voice');

    return {
      llm: {
        count: llm.length,
        cost: llm.reduce((sum, u) => sum + (u.cost_usd || 0), 0),
        tokens: llm.reduce((sum, u) => sum + (u.tokens_used || 0), 0)
      },
      voice: {
        count: voice.length,
        cost: voice.reduce((sum, u) => sum + (u.cost_usd || 0), 0)
      }
    };
  }, [usage]);

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

  // Usar os nomes atuais do DB mas preparar para migração
  const llmCredits = credits.openai_credits || 0;
  const voiceCredits = credits.elevenlabs_credits || 0;
  const llmPercent = Math.min(llmCredits / 1000 * 100, 100);
  const voicePercent = Math.min(voiceCredits / 500 * 100, 100);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Créditos</h1>
          <p className="text-muted-foreground">Gerencie seus créditos e acompanhe o uso das IAs</p>
        </div>

        {/* Status dos Créditos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LLM Credits */}
          <Card className={llmPercent < 20 ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Créditos LLM
                {llmPercent < 20 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </CardTitle>
              <CardDescription>Para chat terapêutico e análises (OpenRouter)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-purple-500">
                {llmCredits.toLocaleString('pt-BR')}
              </div>
              <Progress value={llmPercent} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Gasto total: ${(credits.total_spent_openai || 0).toFixed(2)}</span>
                <span>{llmPercent.toFixed(0)}%</span>
              </div>
              <Button
                onClick={() => purchaseCredits('llm', 1000)}
                variant={llmPercent < 20 ? "default" : "outline"}
                className="w-full"
              >
                Comprar Créditos LLM
              </Button>
            </CardContent>
          </Card>

          {/* Voice Credits */}
          <Card className={voicePercent < 20 ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-blue-500" />
                Créditos de Voz
                {voicePercent < 20 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </CardTitle>
              <CardDescription>Para clonagem de voz e áudios (VoiceKiller)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-blue-500">
                {voiceCredits.toLocaleString('pt-BR')}
              </div>
              <Progress value={voicePercent} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Gasto total: ${(credits.total_spent_elevenlabs || 0).toFixed(2)}</span>
                <span>{voicePercent.toFixed(0)}%</span>
              </div>
              <Button
                onClick={() => purchaseCredits('voice', 500)}
                variant={voicePercent < 20 ? "default" : "outline"}
                className="w-full"
              >
                Comprar Créditos de Voz
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Economia com Cache */}
        {cacheStats.totalFragments > 0 && (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <HardDrive className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  💰 Você economizou ~${cacheStats.estimatedSavings.toFixed(2)} com cache de áudio!
                </p>
                <p className="text-sm text-muted-foreground">
                  {cacheStats.totalFragments} fragmentos de áudio reutilizados
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                  <li>✓ 500 créditos LLM</li>
                  <li>✓ 250 créditos de Voz</li>
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
                  <li>✓ 1500 créditos LLM</li>
                  <li>✓ 750 créditos de Voz</li>
                  <li>✓ 30 sessões de terapia</li>
                  <li>✓ Mapa astral integrado</li>
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
                  <li>✓ 3000 créditos LLM</li>
                  <li>✓ 1500 créditos de Voz</li>
                  <li>✓ Sessões ilimitadas</li>
                  <li>✓ Múltiplas vozes clonadas</li>
                  <li>✓ API access</li>
                </ul>
                <Button variant="outline" className="w-full">Escolher Pro</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Uso com Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Histórico de Uso (Últimos 30 dias)
            </CardTitle>
            <CardDescription>Acompanhe como seus créditos estão sendo utilizados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumo por tipo */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">LLM (OpenRouter)</p>
                  <p className="text-xs text-muted-foreground">
                    {usageByType.llm.count} operações | {usageByType.llm.tokens.toLocaleString()} tokens
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Voz (VoiceKiller)</p>
                  <p className="text-xs text-muted-foreground">
                    {usageByType.voice.count} operações | ${usageByType.voice.cost.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs de filtro */}
            <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">Todos ({usage.length})</TabsTrigger>
                <TabsTrigger value="llm">LLM ({usageByType.llm.count})</TabsTrigger>
                <TabsTrigger value="voice">Voz ({usageByType.voice.count})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Lista de uso */}
            {filteredUsage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum uso registrado nos últimos 30 dias
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredUsage.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getServiceIcon(item.service)}
                      <div>
                        <p className="font-medium text-sm">{getOperationLabel(item.operation_type)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {getServiceLabel(item.service)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <DollarSign className="h-3 w-3" />
                        {item.cost_usd?.toFixed(3) || '0.000'}
                      </div>
                      {item.tokens_used && (
                        <p className="text-xs text-muted-foreground">
                          {item.tokens_used.toLocaleString()} tokens
                        </p>
                      )}
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