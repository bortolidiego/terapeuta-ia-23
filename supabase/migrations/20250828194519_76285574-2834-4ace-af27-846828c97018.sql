-- CRITICAL SECURITY PATCH: Fix Therapy Data Access Vulnerabilities (Part 1)
-- This addresses the security finding about unauthorized access to therapy session content

-- 1. CRITICAL: Fix NULL session_id vulnerability in therapy_facts
-- Update any NULL session_ids before making the column NOT NULL
UPDATE public.therapy_facts 
SET session_id = (
  SELECT ts.id FROM public.therapy_sessions ts 
  WHERE ts.user_id = auth.uid() 
  ORDER BY ts.created_at DESC 
  LIMIT 1
)
WHERE session_id IS NULL;

-- Delete any records that still have NULL session_id (orphaned data)
DELETE FROM public.therapy_facts WHERE session_id IS NULL;

-- Now make session_id NOT NULL
ALTER TABLE public.therapy_facts 
ALTER COLUMN session_id SET NOT NULL;

-- 2. CRITICAL: Fix NULL user_id vulnerability in therapy_sessions
-- Delete any orphaned sessions without user_id (this should not happen in normal operation)
DELETE FROM public.therapy_sessions WHERE user_id IS NULL;

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