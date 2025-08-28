import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuditLogger } from "@/lib/security";

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  onExtendSession: () => void;
  onLogout: () => void;
  timeRemaining: number; // in seconds
}

export const SessionTimeoutWarning = ({
  isOpen,
  onExtendSession,
  onLogout,
  timeRemaining
}: SessionTimeoutWarningProps) => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Auto logout when countdown reaches 0
            AuditLogger.logSecurityEvent('session_timeout_automatic', {
              warningShown: true
            }, user?.id);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, countdown, onLogout, user?.id]);

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  const handleExtendSession = () => {
    AuditLogger.logSecurityEvent('session_extended', {
      timeRemaining: countdown
    }, user?.id);
    onExtendSession();
  };

  const handleLogout = () => {
    AuditLogger.logSecurityEvent('session_timeout_manual', {
      timeRemaining: countdown
    }, user?.id);
    onLogout();
  };

  const progressPercentage = (countdown / timeRemaining) * 100;
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Sessão expirando
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Sua sessão expirará em <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong> por motivos de segurança.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tempo restante</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress 
                value={progressPercentage} 
                className="h-2"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Clique em "Continuar sessão" para permanecer conectado ou "Fazer logout" para sair com segurança.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel asChild>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Fazer logout
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button 
              onClick={handleExtendSession}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Continuar sessão
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};