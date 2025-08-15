-- Criar tabela de protocolos
CREATE TABLE public.therapy_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  steps_config JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de passos de protocolo
CREATE TABLE public.protocol_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID NOT NULL,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('question', 'template', 'sentiment_popup', 'ai_normalize', 'generate_commands')),
  content JSONB NOT NULL DEFAULT '{}',
  next_conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de templates de áudio
CREATE TABLE public.audio_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  template_text TEXT NOT NULL,
  audio_url TEXT,
  is_fixed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de execução de protocolos por sessão
CREATE TABLE public.session_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  protocol_id UUID NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  protocol_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.therapy_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_protocols ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage protocols" ON public.therapy_protocols
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active protocols" ON public.therapy_protocols
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage protocol steps" ON public.protocol_steps
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view protocol steps" ON public.protocol_steps
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage audio templates" ON public.audio_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view audio templates" ON public.audio_templates
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their session protocols" ON public.session_protocols
  FOR ALL USING (is_session_owner(session_id))
  WITH CHECK (is_session_owner(session_id));

-- Triggers para updated_at
CREATE TRIGGER update_therapy_protocols_updated_at
  BEFORE UPDATE ON public.therapy_protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audio_templates_updated_at
  BEFORE UPDATE ON public.audio_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_protocols_updated_at
  BEFORE UPDATE ON public.session_protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir protocolo de Evento Traumático Específico
INSERT INTO public.therapy_protocols (name, description, trigger_keywords, steps_config) VALUES 
('evento_traumatico_especifico', 'Protocolo para processamento de eventos traumáticos específicos', 
 ARRAY['trauma', 'aconteceu', 'evento', 'quando', 'primeira vez', 'última vez'],
 '[
   {"step": 1, "type": "ai_normalize", "content": {"prompt": "Normalize o evento em 3 variações: Quando..., A primeira vez que..., A última vez que..."}},
   {"step": 2, "type": "sentiment_popup", "content": {"message": "Selecione os sentimentos relacionados ao evento"}},
   {"step": 3, "type": "generate_commands", "content": {"template": "quantum_commands"}}
 ]'::jsonb);

-- Inserir templates de áudio fixos
INSERT INTO public.audio_templates (template_key, template_text, is_fixed) VALUES 
('quantum_prefix', 'Código ALMA, a minha consciência escolhe:', true),
('quantum_suffix_prejudiciais_recebi', 'ACABARAM!', true),
('quantum_suffix_prejudiciais_senti', 'ACABARAM!', true),
('quantum_espirito_gerou', 'Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei', true),
('quantum_espirito_recebi', 'Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi', true);

-- Criar função para classificar protocolo
CREATE OR REPLACE FUNCTION public.classify_protocol(user_message text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  protocol_name text;
BEGIN
  -- Lógica simples de classificação baseada em palavras-chave
  IF user_message ILIKE '%quando%' OR user_message ILIKE '%aconteceu%' OR user_message ILIKE '%primeira vez%' OR user_message ILIKE '%trauma%' THEN
    RETURN 'evento_traumatico_especifico';
  END IF;
  
  -- Default para evento específico se não identificar
  RETURN 'evento_traumatico_especifico';
END;
$function$;