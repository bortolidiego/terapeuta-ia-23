-- Add unique constraint to ensure only one audio draft per user per session
ALTER TABLE public.user_audio_drafts 
ADD CONSTRAINT unique_audio_draft_per_session 
UNIQUE (user_id, session_id);