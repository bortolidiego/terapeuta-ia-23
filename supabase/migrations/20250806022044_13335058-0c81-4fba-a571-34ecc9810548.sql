-- Create therapist configuration table
CREATE TABLE public.therapist_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  main_prompt TEXT NOT NULL DEFAULT 'Você é um terapeuta virtual compassivo e profissional.',
  model_name TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create knowledge base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create therapy sessions table
CREATE TABLE public.therapy_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL DEFAULT 'Nova Sessão',
  status TEXT NOT NULL DEFAULT 'active',
  session_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session messages table
CREATE TABLE public.session_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user profiles table (optional)
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  display_name TEXT,
  preferred_language TEXT DEFAULT 'pt-BR',
  session_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.therapist_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for therapist config (admin only for now)
CREATE POLICY "Everyone can view therapist config" 
ON public.therapist_config FOR SELECT USING (true);

CREATE POLICY "Everyone can update therapist config" 
ON public.therapist_config FOR UPDATE USING (true);

CREATE POLICY "Everyone can insert therapist config" 
ON public.therapist_config FOR INSERT WITH CHECK (true);

-- Create policies for knowledge base (admin only for now)
CREATE POLICY "Everyone can view knowledge base" 
ON public.knowledge_base FOR SELECT USING (true);

CREATE POLICY "Everyone can manage knowledge base" 
ON public.knowledge_base FOR ALL USING (true);

-- Create policies for therapy sessions (user-specific when auth is implemented)
CREATE POLICY "Everyone can view their sessions" 
ON public.therapy_sessions FOR SELECT USING (true);

CREATE POLICY "Everyone can create sessions" 
ON public.therapy_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Everyone can update their sessions" 
ON public.therapy_sessions FOR UPDATE USING (true);

-- Create policies for session messages
CREATE POLICY "Everyone can view session messages" 
ON public.session_messages FOR SELECT USING (true);

CREATE POLICY "Everyone can create session messages" 
ON public.session_messages FOR INSERT WITH CHECK (true);

-- Create policies for user profiles
CREATE POLICY "Everyone can view and manage profiles" 
ON public.user_profiles FOR ALL USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_therapist_config_updated_at
  BEFORE UPDATE ON public.therapist_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapy_sessions_updated_at
  BEFORE UPDATE ON public.therapy_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.therapist_config (main_prompt, model_name, temperature, max_tokens)
VALUES (
  'Você é um terapeuta virtual compassivo e profissional. Sua missão é oferecer apoio emocional, escutar ativamente e fornecer orientações terapêuticas baseadas em abordagens como Terapia Cognitivo-Comportamental (TCC). Mantenha sempre um tom acolhedor, empático e não julgador. Faça perguntas reflexivas para ajudar o usuário a entender melhor seus sentimentos e pensamentos.',
  'gpt-4o-mini',
  0.7,
  1000
);

-- Insert sample knowledge base entries
INSERT INTO public.knowledge_base (title, content, category, keywords) VALUES
(
  'Técnicas de Respiração',
  'A respiração consciente é uma ferramenta poderosa para reduzir ansiedade. Exercício: Inspire por 4 segundos, segure por 4 segundos, expire por 6 segundos. Repita 5 vezes.',
  'ansiedade',
  '{"respiração", "ansiedade", "relaxamento", "técnica"}'
),
(
  'Identificação de Pensamentos Automáticos',
  'Os pensamentos automáticos são ideias que surgem espontaneamente em nossa mente. Para identificá-los: 1) Observe suas emoções, 2) Pergunte-se "O que estava pensando?", 3) Anote o pensamento, 4) Questione sua veracidade.',
  'tcc',
  '{"pensamentos", "tcc", "cognição", "autoconhecimento"}'
),
(
  'Gestão de Crises de Ansiedade',
  'Durante uma crise: 1) Reconheça que é temporária, 2) Use a técnica 5-4-3-2-1 (5 coisas que vê, 4 que toca, 3 que ouve, 2 que cheira, 1 que saboreia), 3) Respire profundamente, 4) Busque um local seguro.',
  'emergência',
  '{"crise", "ansiedade", "emergência", "técnica"}'
);