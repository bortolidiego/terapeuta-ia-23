import { useAuth } from '@/hooks/useAuth';
import SecurityDashboard from '@/components/SecurityDashboard';
import TherapyDataSecurityMonitor from '@/components/TherapyDataSecurityMonitor';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Security = () => {
  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel de Segurança</h1>
          <p className="text-muted-foreground">
            Monitore eventos de segurança, logs de auditoria e proteção de dados terapêuticos.
          </p>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="therapy">Dados Terapêuticos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <SecurityDashboard />
          </TabsContent>
          
          <TabsContent value="therapy">
            <TherapyDataSecurityMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
};

export default Security;