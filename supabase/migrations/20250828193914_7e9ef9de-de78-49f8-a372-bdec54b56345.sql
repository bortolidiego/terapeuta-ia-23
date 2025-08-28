-- CRITICAL SECURITY PATCH: Fix Therapy Data Access Vulnerabilities
-- This addresses the security finding about unauthorized access to therapy session content

-- 1. CRITICAL: Fix NULL session_id vulnerability in therapy_facts
-- This prevents bypass of ownership checks when session_id is NULL
ALTER TABLE public.therapy_facts 
ALTER COLUMN session_id SET NOT NULL;

-- 2. CRITICAL: Fix NULL user_id vulnerability in therapy_sessions  
-- This prevents orphaned sessions that could be accessed by anyone
ALTER TABLE public.therapy_sessions 
ALTER COLUMN user_id SET NOT NULL;

-- 3. ENHANCED: Strengthen is_session_owner function with additional validation
CREATE OR REPLACE FUNCTION public.is_session_owner(session_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Critical validation: reject NULL inputs immediately
  IF session_uuid IS NULL THEN
    -- Log potential security breach attempt
    INSERT INTO public.audit_logs (
      table_name, operation, user_id, new_data, timestamp
    ) VALUES (
      'security_violation', 'NULL_SESSION_ACCESS_ATTEMPT', 
      auth.uid(),
      json_build_object('attempted_session_id', session_uuid, 'user_id', auth.uid()),
      now()
    );
    RETURN FALSE;
  END IF;
  
  -- Enhanced ownership check with additional validation
  RETURN EXISTS (
    SELECT 1 FROM public.therapy_sessions 
    WHERE id = session_uuid 
    AND user_id = auth.uid()
    AND user_id IS NOT NULL  -- Extra safety check
    AND auth.uid() IS NOT NULL -- Ensure authenticated user
  );
END;
$$;

-- 4. CRITICAL: Add missing DELETE protection policies
CREATE POLICY "Users cannot delete session messages" 
ON public.session_messages 
FOR DELETE 
USING (false); -- Therapy messages should NEVER be deleted

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

-- 6. ENHANCED: Add therapy data access monitoring
CREATE OR REPLACE FUNCTION public.log_therapy_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log all access to sensitive therapy data
  INSERT INTO public.audit_logs (
    table_name, operation, user_id, new_data, timestamp
  ) VALUES (
    TG_TABLE_NAME,
    'THERAPY_DATA_ACCESS',
    auth.uid(),
    json_build_object(
      'session_id', COALESCE(NEW.session_id, OLD.session_id),
      'operation_type', TG_OP,
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add access monitoring triggers
CREATE TRIGGER log_session_messages_access
  AFTER SELECT ON public.session_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_therapy_data_access();

CREATE TRIGGER log_therapy_facts_access  
  AFTER SELECT ON public.therapy_facts
  FOR EACH ROW EXECUTE FUNCTION public.log_therapy_data_access();

-- 7. ENHANCED: Add session validation function for extra security
CREATE OR REPLACE FUNCTION public.validate_therapy_session_access(session_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_record RECORD;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Reject if no user or session
  IF current_user_id IS NULL OR session_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Validate session exists and belongs to user
  SELECT user_id, status INTO session_record
  FROM public.therapy_sessions
  WHERE id = session_uuid;
  
  -- Session must exist, belong to user, and be valid
  IF NOT FOUND OR session_record.user_id != current_user_id THEN
    -- Log unauthorized access attempt
    INSERT INTO public.audit_logs (
      table_name, operation, user_id, new_data, timestamp
    ) VALUES (
      'security_violation', 'UNAUTHORIZED_THERAPY_ACCESS', 
      current_user_id,
      json_build_object(
        'attempted_session_id', session_uuid,
        'session_owner', session_record.user_id,
        'current_user', current_user_id
      ),
      now()
    );
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;