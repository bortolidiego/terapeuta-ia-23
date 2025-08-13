-- Create function to pause consultation
CREATE OR REPLACE FUNCTION public.pause_consultation(consultation_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.therapy_sessions 
  SET status = 'paused', updated_at = now()
  WHERE id = consultation_uuid 
  AND user_id = auth.uid()
  AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation not found or not active';
  END IF;
END;
$function$;