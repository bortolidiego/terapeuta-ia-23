import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UserHeader = () => {
  const { user, userRole, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleAdminClick = () => {
    navigate('/admin');
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-card">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="text-sm font-medium">{user?.email}</span>
        </div>
        <Badge variant={isAdmin() ? "default" : "secondary"}>
          {isAdmin() ? "Admin" : "Usuário"}
        </Badge>
      </div>
      
      <div className="flex items-center gap-2">
        {isAdmin() && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAdminClick}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Admin
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={signOut}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default UserHeader;