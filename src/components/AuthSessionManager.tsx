import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SessionManager } from '@/lib/utils';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';
import { AuditLogger } from '@/lib/security';

const AuthSessionManager = () => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes default
  const { user, signOut } = useAuth();

  const handleSessionTimeout = useCallback(() => {
    AuditLogger.logSecurityEvent('session_timeout', {
      userId: user?.id,
      timestamp: Date.now()
    }, user?.id);
    
    signOut();
    setShowTimeoutWarning(false);
  }, [user, signOut]);

  const handleSessionWarning = useCallback(() => {
    setShowTimeoutWarning(true);
    setTimeRemaining(300); // 5 minutes warning
    
    AuditLogger.logSecurityEvent('session_warning_shown', {
      userId: user?.id,
      timestamp: Date.now()
    }, user?.id);
  }, [user]);

  const handleExtendSession = useCallback(() => {
    setShowTimeoutWarning(false);
    
    // Reset session timeout
    SessionManager.resetSession(handleSessionTimeout, handleSessionWarning);
    
    AuditLogger.logSecurityEvent('session_extended', {
      userId: user?.id,
      timestamp: Date.now()
    }, user?.id);
  }, [handleSessionTimeout, handleSessionWarning, user]);

  const handleLogoutFromWarning = useCallback(() => {
    AuditLogger.logSecurityEvent('session_manual_logout', {
      userId: user?.id,
      timestamp: Date.now()
    }, user?.id);
    
    signOut();
    setShowTimeoutWarning(false);
  }, [user, signOut]);

  useEffect(() => {
    if (user) {
      // Start session management when user logs in
      SessionManager.startSession(handleSessionTimeout, handleSessionWarning);
      
      return () => {
        // Clear session management when component unmounts or user logs out
        SessionManager.clearSession();
      };
    }
  }, [user, handleSessionTimeout, handleSessionWarning]);

  // Reset activity listeners when user interacts with the page
  useEffect(() => {
    if (!user) return;

    const resetActivity = () => {
      if (user && !showTimeoutWarning) {
        SessionManager.resetSession(handleSessionTimeout, handleSessionWarning);
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, resetActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetActivity, true);
      });
    };
  }, [user, showTimeoutWarning, handleSessionTimeout, handleSessionWarning]);

  return (
    <SessionTimeoutWarning
      isOpen={showTimeoutWarning}
      onExtendSession={handleExtendSession}
      onLogout={handleLogoutFromWarning}
      timeRemaining={timeRemaining}
    />
  );
};

export default AuthSessionManager;