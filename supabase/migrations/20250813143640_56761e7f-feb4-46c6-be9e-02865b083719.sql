-- Create storage bucket for audio drafts
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-drafts', 'audio-drafts', false);

-- Create user_drafts table for text drafts
CREATE TABLE public.user_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  draft_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_drafts
ALTER TABLE public.user_drafts ENABLE ROW LEVEL SECURITY;

-- Create policies for user_drafts
CREATE POLICY "Users can view their own drafts"
ON public.user_drafts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drafts"
ON public.user_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
ON public.user_drafts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
ON public.user_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- Create user_audio_drafts table
CREATE TABLE public.user_audio_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  audio_path TEXT NOT NULL,
  audio_duration INTEGER,
  audio_size BIGINT,
  mime_type TEXT DEFAULT 'audio/webm',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_audio_drafts
ALTER TABLE public.user_audio_drafts ENABLE ROW LEVEL SECURITY;

-- Create policies for user_audio_drafts
CREATE POLICY "Users can view their own audio drafts"
ON public.user_audio_drafts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audio drafts"
ON public.user_audio_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio drafts"
ON public.user_audio_drafts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio drafts"
ON public.user_audio_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage policies for audio-drafts bucket
CREATE POLICY "Users can view their own audio draft files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own audio draft files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'audio-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own audio draft files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'audio-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio draft files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'audio-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updating updated_at on user_drafts
CREATE TRIGGER update_user_drafts_updated_at
BEFORE UPDATE ON public.user_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_user_drafts_user_session ON public.user_drafts(user_id, session_id);
CREATE INDEX idx_user_audio_drafts_user_session ON public.user_audio_drafts(user_id, session_id);