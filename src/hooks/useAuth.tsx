import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuditLogger, RateLimiter } from '@/lib/security';
import { SessionManager } from '@/lib/utils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'admin' | 'user' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role || 'user';
    } catch (error) {
      console.error('Error fetching user role:', error);
      return 'user';
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer role fetching with setTimeout to prevent deadlock
          setTimeout(async () => {
            const role = await fetchUserRole(session.user.id);
            setUserRole(role);
            setLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        setUserRole(role);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Rate limiting for login attempts
    if (!RateLimiter.checkLimit(`login_${email}`, 5, 300000)) { // 5 attempts per 5 minutes
      AuditLogger.logSecurityEvent('login_rate_limited', { email });
      return { error: { message: 'Muitas tentativas de login. Tente novamente em 5 minutos.' } };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        AuditLogger.logSecurityEvent('login_failed', { 
          email, 
          error: error.message,
          userAgent: navigator.userAgent 
        });
        
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
      } else {
        AuditLogger.logSecurityEvent('login_successful', { 
          email,
          userAgent: navigator.userAgent 
        });
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta.",
        });

        // Start session timeout management
        SessionManager.startSession(
          () => signOut(), // Auto logout on timeout
          () => {
            // Show timeout warning
            toast({
              title: "Sessão expirando",
              description: "Sua sessão expirará em 5 minutos por motivos de segurança.",
            });
          }
        );
      }

      return { error };
    } catch (error: any) {
      AuditLogger.logSecurityEvent('login_error', { 
        email, 
        error: error.message 
      });
      
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar a conta.",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clear session timeout
      SessionManager.clearSession();
      
      // Log logout event
      AuditLogger.logSecurityEvent('logout', { 
        userId: user?.id,
        sessionDuration: Date.now() // Could calculate actual duration
      }, user?.id);
      
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    } catch (error: any) {
      AuditLogger.logSecurityEvent('logout_error', { 
        error: error.message 
      }, user?.id);
      
      toast({
        title: "Erro no logout",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    }
  };

  const isAdmin = () => userRole === 'admin';

  const value: AuthContextType = {
    user,
    session,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};