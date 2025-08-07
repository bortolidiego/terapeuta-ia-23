import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  BarChart3,
  RefreshCw,
  Zap,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  averageResponseTime: number;
  errorRate: number;
  modelDistribution: Record<string, number>;
  lastUpdated: string;
}

interface MonitoringProps {
  period?: '24h' | '7d' | '30d';
}

export const OpenAIMonitoring: React.FC<MonitoringProps> = ({ period = '24h' }) => {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Simulação de dados para demonstração
  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Simular dados de monitoramento
      const mockMetrics: UsageMetrics = {
        totalRequests: period === '24h' ? 127 : period === '7d' ? 892 : 3456,
        totalTokens: period === '24h' ? 15420 : period === '7d' ? 108940 : 423560,
        estimatedCost: period === '24h' ? 2.34 : period === '7d' ? 16.42 : 64.28,
        averageResponseTime: 1.8,
        errorRate: 2.1,
        modelDistribution: {
          'gpt-4.1-2025-04-14': 65,
          'gpt-4o-mini': 25,
          'o3-2025-04-16': 10
        },
        lastUpdated: new Date().toISOString()
      };
      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as métricas de monitoramento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const getCostColor = (cost: number) => {
    if (cost > 50) return 'text-red-500';
    if (cost > 20) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getErrorRateColor = (rate: number) => {
    if (rate > 5) return 'text-red-500';
    if (rate > 2) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Requisições</span>
            </div>
            <div className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Últimas {period}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Tokens</span>
            </div>
            <div className="text-2xl font-bold">{metrics.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total processados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Custo Estimado</span>
            </div>
            <div className={`text-2xl font-bold ${getCostColor(metrics.estimatedCost)}`}>
              ${metrics.estimatedCost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">USD</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Tempo Médio</span>
            </div>
            <div className="text-2xl font-bold">{metrics.averageResponseTime}s</div>
            <p className="text-xs text-muted-foreground">Resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de erro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Taxa de Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold ${getErrorRateColor(metrics.errorRate)}`}>
                  {metrics.errorRate}%
                </span>
                <Badge variant={metrics.errorRate > 5 ? "destructive" : metrics.errorRate > 2 ? "default" : "secondary"}>
                  {metrics.errorRate > 5 ? "Alto" : metrics.errorRate > 2 ? "Médio" : "Baixo"}
                </Badge>
              </div>
              <Progress value={metrics.errorRate} max={10} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {metrics.errorRate < 2 ? "Sistema funcionando normalmente" : 
                 metrics.errorRate < 5 ? "Alguns erros detectados" : 
                 "Taxa de erro elevada - verificar configurações"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de modelos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Uso por Modelo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.modelDistribution).map(([model, percentage]) => (
                <div key={model} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{model}</span>
                    <span>{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Última atualização: {new Date(metrics.lastUpdated).toLocaleString('pt-BR')}
        </div>
        <Button onClick={loadMetrics} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Alertas e recomendações */}
      {(metrics.errorRate > 5 || metrics.estimatedCost > 50) && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Atenção necessária
                </h4>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {metrics.errorRate > 5 && (
                    <p>• Taxa de erro elevada ({metrics.errorRate}%) - verificar configurações da API</p>
                  )}
                  {metrics.estimatedCost > 50 && (
                    <p>• Custo elevado (${metrics.estimatedCost}) - considere otimizar o uso de tokens</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};