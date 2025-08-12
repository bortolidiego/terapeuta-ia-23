-- Corrigir search_path da função de segurança
CREATE OR REPLACE FUNCTION public.is_session_owner(session_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapy_sessions 
    WHERE id = session_uuid AND user_id = auth.uid()
  );
$$;