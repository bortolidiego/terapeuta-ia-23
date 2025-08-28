import { useAuth } from '@/hooks/useAuth';
import SecurityDashboard from '@/components/SecurityDashboard';
import ProtectedRoute from '@/components/ProtectedRoute';

const Security = () => {
  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel de Segurança</h1>
          <p className="text-muted-foreground">
            Monitore eventos de segurança, logs de auditoria e atividades do sistema.
          </p>
        </div>
        <SecurityDashboard />
      </div>
    </ProtectedRoute>
  );
};

export default Security;