import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AuditLogger } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

interface TherapyDataSecurityProps {
  children: React.ReactNode;
  sessionId?: string;
}

/**
 * Security wrapper component that validates access to therapy-related data
 * Implements additional client-side checks before accessing sensitive mental health data
 */
const TherapyDataSecurity = ({ children, sessionId }: TherapyDataSecurityProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Enhanced session validation for therapy data access
  const validateTherapySessionAccess = async (sessionUuid: string) => {
    if (!user || !sessionUuid) {
      AuditLogger.logSecurityEvent('therapy_access_denied', {
        reason: 'missing_user_or_session',
        sessionId: sessionUuid,
        userId: user?.id
      }, user?.id);
      return false;
    }

    try {
      // Double-check session ownership at the client level
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('user_id, status')
        .eq('id', sessionUuid)
        .single();

      if (error || !data) {
        AuditLogger.logSecurityEvent('therapy_session_not_found', {
          sessionId: sessionUuid,
          error: error?.message
        }, user.id);
        return false;
      }

      if (data.user_id !== user.id && !isAdmin()) {
        // CRITICAL: Attempted unauthorized access to therapy data
        AuditLogger.logSecurityEvent('unauthorized_therapy_access_attempt', {
          sessionId: sessionUuid,
          sessionOwner: data.user_id,
          attemptedBy: user.id,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }, user.id);
        
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar estes dados de terapia",
          variant: "destructive",
        });
        
        return false;
      }

      // Log legitimate access for monitoring
      AuditLogger.logSecurityEvent('therapy_session_accessed', {
        sessionId: sessionUuid,
        accessType: 'legitimate'
      }, user.id);

      return true;
    } catch (error) {
      console.error('Error validating therapy session access:', error);
      AuditLogger.logSecurityEvent('therapy_validation_error', {
        sessionId: sessionUuid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, user?.id);
      return false;
    }
  };

  // Monitor for unauthorized access attempts
  useEffect(() => {
    if (sessionId && user) {
      validateTherapySessionAccess(sessionId);
    }
  }, [sessionId, user]);

  // Enhanced security monitoring for therapy data components
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionId) {
        // Log when user navigates away from therapy data
        AuditLogger.logSecurityEvent('therapy_session_backgrounded', {
          sessionId,
          timestamp: new Date().toISOString()
        }, user?.id);
      }
    };

    const handleBeforeUnload = () => {
      if (sessionId) {
        // Log when user is about to leave therapy session
        AuditLogger.logSecurityEvent('therapy_session_ended', {
          sessionId,
          timestamp: new Date().toISOString()
        }, user?.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, user]);

  // Only render children if user is authenticated
  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default TherapyDataSecurity;