-- Expandir user_profiles com dados pessoais e voz clonada
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birth_city TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cloned_voice_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS voice_library_status TEXT DEFAULT 'not_started';

-- Criar tabela de notificações em tempo real
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de biblioteca de áudios personalizada
CREATE TABLE IF NOT EXISTS user_audio_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  component_key TEXT NOT NULL,
  component_type TEXT, -- 'base' | 'sentiment'
  sentiment_name TEXT,
  audio_path TEXT,
  generation_method TEXT, -- 'ai' | 'manual'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de créditos para monetização
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID NOT NULL PRIMARY KEY,
  openai_credits INTEGER NOT NULL DEFAULT 1000,
  elevenlabs_credits INTEGER NOT NULL DEFAULT 500,
  total_spent_openai DECIMAL NOT NULL DEFAULT 0,
  total_spent_elevenlabs DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de rastreamento de uso
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service TEXT NOT NULL, -- 'openai' | 'elevenlabs'
  operation_type TEXT NOT NULL, -- 'chat', 'voice_clone', 'audio_generation'
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar título gerado automaticamente para sessões
ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS auto_generated_title TEXT;

-- Habilitar RLS nas novas tabelas
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audio_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_notifications
CREATE POLICY "Users can view their own notifications" 
ON user_notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON user_notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas RLS para user_audio_library
CREATE POLICY "Users can manage their own audio library" 
ON user_audio_library FOR ALL 
USING (auth.uid() = user_id);

-- Políticas RLS para user_credits
CREATE POLICY "Users can view their own credits" 
ON user_credits FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits" 
ON user_credits FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas RLS para usage_tracking
CREATE POLICY "Users can view their own usage tracking" 
ON usage_tracking FOR SELECT 
USING (auth.uid() = user_id);

-- Função para atualizar timestamps
CREATE TRIGGER update_user_notifications_updated_at
BEFORE UPDATE ON user_notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_audio_library_updated_at
BEFORE UPDATE ON user_audio_library
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON user_credits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger para criar créditos iniciais quando usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir créditos iniciais para o usuário
  INSERT INTO public.user_credits (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Atualizar trigger existente para incluir créditos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir perfil do usuário se não existir
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Inserir créditos iniciais
  INSERT INTO public.user_credits (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Se for o email do admin, atribuir papel de admin
  IF NEW.email = 'bortolidiego@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Para outros usuários, atribuir papel de user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();