import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertTriangle, Eye, Trash2, Download } from "lucide-react";
import { AuditLogger } from "@/lib/security";
import { useAuth } from "@/hooks/useAuth";

export const SecurityAuditPanel = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'auth' | 'data' | 'admin'>('all');

  useEffect(() => {
    if (isAdmin()) {
      loadLogs();
    }
  }, [isAdmin]);

  useEffect(() => {
    filterLogs();
  }, [logs, filter]);

  const loadLogs = () => {
    const securityLogs = AuditLogger.getSecurityLogs();
    setLogs(securityLogs.reverse()); // Most recent first
  };

  const filterLogs = () => {
    let filtered = logs;
    
    switch (filter) {
      case 'auth':
        filtered = logs.filter(log => 
          log.event.includes('login') || 
          log.event.includes('logout') || 
          log.event.includes('auth')
        );
        break;
      case 'data':
        filtered = logs.filter(log => 
          log.event.includes('profile') || 
          log.event.includes('data') || 
          log.event.includes('update')
        );
        break;
      case 'admin':
        filtered = logs.filter(log => 
          log.event.includes('admin') || 
          log.event.includes('role')
        );
        break;
      default:
        filtered = logs;
    }
    
    setFilteredLogs(filtered);
  };

  const clearLogs = () => {
    localStorage.removeItem('security_logs');
    setLogs([]);
    AuditLogger.logSecurityEvent('audit_logs_cleared', { admin: true });
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `security_logs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    AuditLogger.logSecurityEvent('audit_logs_exported', { admin: true });
  };

  const getEventIcon = (event: string) => {
    if (event.includes('login') || event.includes('auth')) {
      return <Shield className="h-4 w-4 text-primary" />;
    }
    if (event.includes('error') || event.includes('failed')) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    return <Eye className="h-4 w-4 text-muted-foreground" />;
  };

  const getEventBadgeColor = (event: string) => {
    if (event.includes('error') || event.includes('failed')) {
      return 'destructive';
    }
    if (event.includes('login') || event.includes('auth')) {
      return 'default';
    }
    return 'secondary';
  };

  if (!isAdmin()) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Acesso restrito a administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Auditoria de Segurança
            </CardTitle>
            <CardDescription>
              Monitoramento de eventos de segurança e acesso a dados
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="destructive" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Todos ({logs.length})</TabsTrigger>
            <TabsTrigger value="auth">Autenticação</TabsTrigger>
            <TabsTrigger value="data">Dados</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>
          
          <TabsContent value={filter} className="mt-4">
            <ScrollArea className="h-96">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum evento registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      {getEventIcon(log.event)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getEventBadgeColor(log.event) as any}>
                            {log.event}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          {log.userId && (
                            <p className="text-muted-foreground">
                              Usuário: {log.userId}
                            </p>
                          )}
                          {Object.entries(log.details || {}).map(([key, value]) => (
                            <p key={key} className="text-xs">
                              <span className="font-medium">{key}:</span>{' '}
                              <span className="text-muted-foreground">
                                {typeof value === 'object' 
                                  ? JSON.stringify(value) 
                                  : String(value)
                                }
                              </span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};