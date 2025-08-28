-- Critical Security Hardening Migration
-- 1. Add audit triggers for sensitive data access
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log access to sensitive user data
  INSERT INTO public.audit_logs (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    ip_address,
    user_agent,
    timestamp
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  timestamp timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add triggers to monitor sensitive data access
CREATE TRIGGER audit_user_profiles_access
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_data_access();

CREATE TRIGGER audit_session_messages_access
  AFTER INSERT OR UPDATE OR DELETE ON public.session_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_data_access();

CREATE TRIGGER audit_therapy_facts_access
  AFTER INSERT OR UPDATE OR DELETE ON public.therapy_facts
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_data_access();

-- 3. Enhanced validation function for sensitive data
CREATE OR REPLACE FUNCTION public.validate_sensitive_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate CPF format if provided
  IF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    -- Remove formatting
    NEW.cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    -- Check length
    IF length(NEW.cpf) != 11 THEN
      RAISE EXCEPTION 'CPF deve ter 11 dígitos';
    END IF;
    
    -- Check for repeated digits
    IF NEW.cpf ~ '^(.)\1+$' THEN
      RAISE EXCEPTION 'CPF não pode ter todos os dígitos iguais';
    END IF;
  END IF;
  
  -- Validate name length and characters
  IF NEW.full_name IS NOT NULL THEN
    IF length(NEW.full_name) < 2 THEN
      RAISE EXCEPTION 'Nome deve ter pelo menos 2 caracteres';
    END IF;
    
    IF length(NEW.full_name) > 100 THEN
      RAISE EXCEPTION 'Nome muito longo (máximo 100 caracteres)';
    END IF;
    
    -- Basic XSS protection
    IF NEW.full_name ~ '[<>]' THEN
      RAISE EXCEPTION 'Nome contém caracteres inválidos';
    END IF;
  END IF;
  
  -- Validate birth date
  IF NEW.birth_date IS NOT NULL THEN
    IF NEW.birth_date > CURRENT_DATE - INTERVAL '13 years' THEN
      RAISE EXCEPTION 'Usuário deve ter pelo menos 13 anos';
    END IF;
    
    IF NEW.birth_date < CURRENT_DATE - INTERVAL '120 years' THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add validation trigger to user_profiles
CREATE TRIGGER validate_user_profiles_data
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_sensitive_data();

-- 4. Rate limiting table for database-level protection
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type)
);

-- Enable RLS on rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limits
CREATE POLICY "Users can view their own rate limits" 
ON public.rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- 5. Enhanced security for admin functions
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    -- Log unauthorized admin access attempt
    INSERT INTO public.audit_logs (
      table_name,
      operation,
      user_id,
      new_data,
      timestamp
    ) VALUES (
      'admin_access_attempt',
      'UNAUTHORIZED',
      auth.uid(),
      json_build_object(
        'attempted_function', 'require_admin',
        'user_agent', current_setting('request.headers', true)::json->>'user-agent'
      ),
      now()
    );
    
    RAISE EXCEPTION 'Acesso negado: privilégios de administrador necessários';
  END IF;
END;
$$;