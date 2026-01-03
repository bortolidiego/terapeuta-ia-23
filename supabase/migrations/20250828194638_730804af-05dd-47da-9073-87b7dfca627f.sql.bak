-- CRITICAL SECURITY PATCH: Fix Therapy Data Access Vulnerabilities (Part 2)

-- 4. CRITICAL: Add missing DELETE protection policies (check if they exist first)
DROP POLICY IF EXISTS "Users cannot delete session messages" ON public.session_messages;
CREATE POLICY "Users cannot delete session messages" 
ON public.session_messages 
FOR DELETE 
USING (false); -- Therapy messages should NEVER be deleted

DROP POLICY IF EXISTS "Users cannot delete therapy facts" ON public.therapy_facts;
CREATE POLICY "Users cannot delete therapy facts" 
ON public.therapy_facts 
FOR DELETE 
USING (false); -- Therapy insights should NEVER be deleted

-- 5. ENHANCED: Strengthen existing policies with additional checks
DROP POLICY IF EXISTS "Users can view messages from their own sessions" ON public.session_messages;
CREATE POLICY "Users can view messages from their own sessions" 
ON public.session_messages 
FOR SELECT 
USING (
  is_session_owner(session_id) 
  AND session_id IS NOT NULL 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can view facts from their own sessions" ON public.therapy_facts;
CREATE POLICY "Users can view facts from their own sessions" 
ON public.therapy_facts 
FOR SELECT 
USING (
  is_session_owner(session_id) 
  AND session_id IS NOT NULL 
  AND auth.uid() IS NOT NULL
);

-- 6. ENHANCED: Add therapy data access monitoring function
CREATE OR REPLACE FUNCTION public.log_sensitive_therapy_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log all access to sensitive therapy data for security monitoring
  INSERT INTO public.audit_logs (
    table_name, operation, user_id, new_data, timestamp
  ) VALUES (
    TG_TABLE_NAME,
    'THERAPY_DATA_ACCESS',
    auth.uid(),
    json_build_object(
      'session_id', COALESCE(NEW.session_id, OLD.session_id),
      'operation_type', TG_OP,
      'record_id', COALESCE(NEW.id, OLD.id),
      'timestamp', now()
    ),
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add monitoring triggers for therapy data access
DROP TRIGGER IF EXISTS monitor_session_messages_access ON public.session_messages;
CREATE TRIGGER monitor_session_messages_access
  AFTER INSERT OR UPDATE ON public.session_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_therapy_access();

DROP TRIGGER IF EXISTS monitor_therapy_facts_access ON public.therapy_facts;
CREATE TRIGGER monitor_therapy_facts_access  
  AFTER INSERT OR UPDATE ON public.therapy_facts
  FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_therapy_access();