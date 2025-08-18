-- Criar tabela para componentes de áudio base
CREATE TABLE public.audio_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_key TEXT NOT NULL UNIQUE,
  component_type TEXT NOT NULL, -- 'base_word', 'sentiment', 'protocol'
  audio_path TEXT, -- caminho no storage quando áudio estiver disponível
  text_content TEXT NOT NULL,
  protocol_type TEXT DEFAULT 'evento_traumatico_especifico',
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  is_available BOOLEAN DEFAULT false, -- se o áudio já foi gerado
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para jobs de montagem de áudio
CREATE TABLE public.assembly_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.therapy_sessions(id),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress_percentage INTEGER DEFAULT 0,
  assembly_instructions JSONB NOT NULL,
  result_audio_path TEXT,
  total_duration_seconds INTEGER,
  total_file_size_bytes BIGINT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.audio_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembly_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas para audio_components
CREATE POLICY "Users can view audio components" 
ON public.audio_components 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage audio components" 
ON public.audio_components 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para assembly_jobs  
CREATE POLICY "Users can view their own assembly jobs" 
ON public.assembly_jobs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assembly jobs" 
ON public.assembly_jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update assembly jobs" 
ON public.assembly_jobs 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_audio_components_updated_at
BEFORE UPDATE ON public.audio_components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assembly_jobs_updated_at
BEFORE UPDATE ON public.assembly_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar templates existentes para audio_components
INSERT INTO public.audio_components (component_key, component_type, text_content, protocol_type)
SELECT 
  template_key as component_key,
  'base_word' as component_type,
  template_text as text_content,
  'evento_traumatico_especifico' as protocol_type
FROM public.audio_templates
WHERE template_key IN (
  'quantum_alma_senti',
  'quantum_alma_recebi', 
  'quantum_alma_senti_geral',
  'quantum_espirito_gerou_completo',
  'quantum_espirito_recebi_completo'
)
ON CONFLICT (component_key) DO UPDATE SET
text_content = EXCLUDED.text_content;