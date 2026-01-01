import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Settings, User, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { VersionBadge } from '@/components/VersionBadge';

const GlobalHeader = () => {
  const { user, userRole, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleAdminClick = () => {
    navigate('/admin');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo/Título à esquerda */}
        <div className="flex items-center gap-2">
          <h1
            className="text-lg font-semibold text-primary cursor-pointer hover:text-primary/80 transition-colors"
            onClick={() => navigate('/')}
          >
            MyHealing Chat
          </h1>
          <VersionBadge />
        </div>

        {/* Botões à direita */}
        <div className="flex items-center gap-2">
          <NotificationDropdown />

          {/* Botão Admin - apenas se for admin */}
          {isAdmin() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdminClick}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}

          {/* Dropdown do Usuário */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={isAdmin() ? "default" : "secondary"}>
                      {isAdmin() ? "Admin" : "Usuário"}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
                <User className="h-4 w-4" />
                Dados Pessoais
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/credits')} className="gap-2">
                <CreditCard className="h-4 w-4" />
                Créditos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;