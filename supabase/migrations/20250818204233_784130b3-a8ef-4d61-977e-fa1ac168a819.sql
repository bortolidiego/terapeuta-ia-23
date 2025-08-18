-- Criar bucket para assembly de áudio
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-assembly', 'audio-assembly', false);

-- Políticas para o bucket audio-assembly
CREATE POLICY "Users can view their own assembly results" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audio-assembly' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "System can upload assembly results" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audio-assembly');

CREATE POLICY "System can update assembly results" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'audio-assembly');

-- Habilitar realtime para assembly_jobs
ALTER TABLE public.assembly_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assembly_jobs;