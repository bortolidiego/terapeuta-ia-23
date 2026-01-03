import { Bell, X, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const NotificationDropdown = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead([notification.id]);
    }

    // Handle specific notification actions
    if (notification.type === 'audio_ready' && notification.metadata?.audio_path) {
      // Navigate to home where the player is located
      window.location.href = `/?play=${notification.metadata.audio_path}`;
      // Alternatively use navigate('/') if available in context, but window.location ensures refresh/params
      // For now, let's assuming navigate is better if we are inside Router
      // navigate(`/?play=${encodeURIComponent(notification.metadata.audio_path)}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'audio_ready':
      case 'audio_processing':
        return <Volume2 className="h-4 w-4 text-primary" />;
      case 'voice_clone_ready':
      case 'voice_clone_processing':
        return <Bell className="h-4 w-4 text-green-500" />;
      case 'credits_low':
        return <Bell className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="p-3 pb-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Notificações</h4>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs h-auto p-1"
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${!notification.read ? 'bg-primary/5' : ''
                  }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className={`text-sm font-medium leading-none ${!notification.read ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                        {notification.title}
                      </h5>

                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="h-6 w-6 p-0 hover:bg-destructive/20"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {notification.message}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};