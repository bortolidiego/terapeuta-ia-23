import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Eye, Lock, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SecurityViolation {
  id: string;
  table_name: string;
  operation: string;
  user_id: string;
  new_data: any;
  timestamp: string;
}

interface TherapyDataAccess {
  session_id: string;
  access_count: number;
  last_accessed: string;
  user_id: string;
}

const TherapyDataSecurityMonitor = () => {
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [therapyAccess, setTherapyAccess] = useState<TherapyDataAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalViolations: 0,
    unauthorizedAttempts: 0,
    therapyDataAccess: 0,
    nullSessionAttempts: 0
  });
  
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const loadSecurityData = async () => {
    if (!isAdmin()) return;
    
    setLoading(true);
    try {
      // Load security violations
      const { data: violationData, error: violationError } = await supabase
        .from('audit_logs')
        .select('*')
        .or('operation.eq.UNAUTHORIZED_THERAPY_ACCESS,operation.eq.NULL_SESSION_ACCESS_ATTEMPT,table_name.eq.security_violation')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (violationError) {
        console.error('Error loading violations:', violationError);
      } else {
        setViolations(violationData || []);
      }

      // Load therapy data access logs
      const { data: accessData, error: accessError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('operation', 'THERAPY_DATA_ACCESS')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (accessError) {
        console.error('Error loading access data:', accessError);
      } else {
        // Process therapy access data
        const accessMap = new Map<string, TherapyDataAccess>();
        
        accessData?.forEach((log) => {
          const sessionId = log.new_data && typeof log.new_data === 'object' 
            ? (log.new_data as any)?.session_id 
            : null;
          if (sessionId) {
            const existing = accessMap.get(sessionId) || {
              session_id: sessionId,
              access_count: 0,
              last_accessed: log.timestamp,
              user_id: log.user_id
            };
            existing.access_count++;
            if (log.timestamp > existing.last_accessed) {
              existing.last_accessed = log.timestamp;
            }
            accessMap.set(sessionId, existing);
          }
        });
        
        setTherapyAccess(Array.from(accessMap.values()));
      }

      // Calculate statistics
      const totalViolations = violationData?.length || 0;
      const unauthorizedAttempts = violationData?.filter(v => 
        v.operation === 'UNAUTHORIZED_THERAPY_ACCESS'
      ).length || 0;
      const nullSessionAttempts = violationData?.filter(v => 
        v.operation === 'NULL_SESSION_ACCESS_ATTEMPT'
      ).length || 0;
      const therapyDataAccess = accessData?.length || 0;

      setStats({
        totalViolations,
        unauthorizedAttempts,
        therapyDataAccess,
        nullSessionAttempts
      });

    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de segurança",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const getSeverityColor = (operation: string) => {
    switch (operation) {
      case 'UNAUTHORIZED_THERAPY_ACCESS':
        return 'destructive';
      case 'NULL_SESSION_ACCESS_ATTEMPT':
        return 'destructive';
      case 'THERAPY_DATA_ACCESS':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getSeverityIcon = (operation: string) => {
    switch (operation) {
      case 'UNAUTHORIZED_THERAPY_ACCESS':
        return <AlertTriangle className="h-4 w-4" />;
      case 'NULL_SESSION_ACCESS_ATTEMPT':
        return <Shield className="h-4 w-4" />;
      case 'THERAPY_DATA_ACCESS':
        return <Eye className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (!isAdmin()) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Apenas administradores podem acessar o monitor de segurança de dados terapêuticos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Critical Security Alert */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Monitor de Segurança Ativo:</strong> Este painel monitora tentativas de acesso não autorizado 
          a dados terapêuticos sensíveis. Qualquer violação deve ser investigada imediatamente.
        </AlertDescription>
      </Alert>

      {/* Security Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>Violações Totais</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalViolations}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Shield className="h-4 w-4 text-orange-500" />
              <span>Tentativas não Autorizadas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.unauthorizedAttempts}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span>Acessos a Dados</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.therapyDataAccess}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Lock className="h-4 w-4 text-purple-500" />
              <span>Tentativas NULL</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.nullSessionAttempts}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="violations" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="violations">Violações de Segurança</TabsTrigger>
            <TabsTrigger value="access">Acesso a Dados Terapêuticos</TabsTrigger>
          </TabsList>
          <Button onClick={loadSecurityData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-red-600">Violações de Segurança Detectadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Carregando violações...</p>
                  </div>
                ) : violations.length === 0 ? (
                  <div className="text-center py-8 text-green-600">
                    <Shield className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhuma violação de segurança detectada</p>
                  </div>
                ) : (
                  violations.map((violation) => (
                    <div key={violation.id} className="flex items-start space-x-3 p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex-shrink-0 text-red-600">
                        {getSeverityIcon(violation.operation)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={getSeverityColor(violation.operation)}>
                            {violation.operation}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(violation.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          <p className="font-medium text-red-800">
                            Usuário: {violation.user_id || 'Não autenticado'}
                          </p>
                          {violation.new_data && (
                            <div className="bg-white p-2 rounded border">
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(violation.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Acesso a Dados Terapêuticos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Carregando acessos...</p>
                  </div>
                ) : therapyAccess.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum acesso a dados terapêuticos registrado</p>
                  </div>
                ) : (
                  therapyAccess.map((access) => (
                    <div key={access.session_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Sessão: {access.session_id.substring(0, 8)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Usuário: {access.user_id.substring(0, 8)}...
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant="secondary">
                          {access.access_count} acessos
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {new Date(access.last_accessed).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TherapyDataSecurityMonitor;