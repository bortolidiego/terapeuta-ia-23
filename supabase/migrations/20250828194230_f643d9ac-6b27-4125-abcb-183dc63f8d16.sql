-- CRITICAL SECURITY PATCH: Fix Therapy Data Access Vulnerabilities
-- This addresses the security finding about unauthorized access to therapy session content

-- 1. CRITICAL: Fix NULL session_id vulnerability in therapy_facts
-- First check if there are any NULL values that need to be handled
UPDATE public.therapy_facts 
SET session_id = (
  SELECT id FROM public.therapy_sessions 
  WHERE user_id = (
    SELECT user_id FROM auth.users 
    WHERE id = auth.uid() 
    LIMIT 1
  ) 
  LIMIT 1
)
WHERE session_id IS NULL;

-- Now make session_id NOT NULL
ALTER TABLE public.therapy_facts 
ALTER COLUMN session_id SET NOT NULL;

-- 2. CRITICAL: Fix NULL user_id vulnerability in therapy_sessions
-- Update any orphaned sessions (this should not happen in normal operation)
UPDATE public.therapy_sessions 
SET user_id = auth.uid()
WHERE user_id IS NULL AND auth.uid() IS NOT NULL;

-- Make user_id NOT NULL
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
DROP POLICY IF EXISTS "Users cannot delete session messages" ON public.session_messages;
DROP POLICY IF EXISTS "Users cannot delete therapy facts" ON public.therapy_facts;

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