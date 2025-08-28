import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, Eye, Download, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuditLogger } from '@/lib/security';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SecurityDashboard = () => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityStats, setSecurityStats] = useState({
    totalLogins: 0,
    failedAttempts: 0,
    dataAccess: 0,
    adminActions: 0
  });
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const loadSecurityData = async () => {
    if (!isAdmin()) return;
    
    setLoading(true);
    try {
      // Load audit logs from database
      const { data: dbLogs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading audit logs:', error);
      }

      // Combine with localStorage logs
      const localLogs = AuditLogger.getSecurityLogs();
      const allLogs = [...(dbLogs || []), ...localLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100);

      setAuditLogs(allLogs);

      // Calculate security stats
      const stats = allLogs.reduce((acc, log) => {
        switch (log.event || log.table_name) {
          case 'login_successful':
            acc.totalLogins++;
            break;
          case 'login_failed':
            acc.failedAttempts++;
            break;
          case 'user_profiles':
          case 'session_messages':
          case 'therapy_facts':
            acc.dataAccess++;
            break;
          case 'admin_access_attempt':
          case 'UNAUTHORIZED':
            acc.adminActions++;
            break;
        }
        return acc;
      }, { totalLogins: 0, failedAttempts: 0, dataAccess: 0, adminActions: 0 });

      setSecurityStats(stats);
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
    if (isAdmin()) {
      loadSecurityData();
    }
  }, [user]);

  const exportLogs = () => {
    const dataStr = JSON.stringify(auditLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `security-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Logs exportados",
      description: "Logs de segurança exportados com sucesso",
    });
  };

  const clearLocalLogs = () => {
    localStorage.removeItem('security_logs');
    loadSecurityData();
    
    toast({
      title: "Logs locais limpos",
      description: "Logs do localStorage foram removidos",
    });
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'login_successful':
      case 'login_failed':
        return <Shield className="h-4 w-4" />;
      case 'user_profiles':
      case 'session_messages':
      case 'therapy_facts':
        return <Eye className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getEventBadgeColor = (event: string) => {
    switch (event) {
      case 'login_successful':
        return 'default';
      case 'login_failed':
      case 'UNAUTHORIZED':
        return 'destructive';
      case 'user_profiles':
      case 'session_messages':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!isAdmin()) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Apenas administradores podem acessar o painel de segurança.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{securityStats.totalLogins}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tentativas Falhadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{securityStats.failedAttempts}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acesso a Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{securityStats.dataAccess}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ações Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{securityStats.adminActions}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Logs de Segurança</CardTitle>
            <div className="flex space-x-2">
              <Button onClick={loadSecurityData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button onClick={exportLogs} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={clearLocalLogs} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Local
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Carregando logs...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2" />
                <p>Nenhum log de segurança encontrado</p>
              </div>
            ) : (
              auditLogs.map((log, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getEventIcon(log.event || log.table_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant={getEventBadgeColor(log.event || log.operation)}>
                        {log.event || log.operation}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{log.table_name || 'Evento de Autenticação'}</p>
                      {log.user_id && (
                        <p className="text-muted-foreground">Usuário: {log.user_id}</p>
                      )}
                      {log.details && typeof log.details === 'object' && (
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityDashboard;