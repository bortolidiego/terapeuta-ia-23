-- Primeiro, vamos garantir que o usuário atual tenha um perfil
INSERT INTO public.user_profiles (user_id, display_name, preferred_language)
SELECT 
  auth.uid(),
  COALESCE(raw_user_meta_data ->> 'display_name', email),
  'pt-BR'
FROM auth.users 
WHERE id = auth.uid()
ON CONFLICT (user_id) DO NOTHING;

-- Inserir créditos iniciais com os valores solicitados
INSERT INTO public.user_credits (user_id, openai_credits, elevenlabs_credits)
SELECT auth.uid(), 10000, 30000
FROM auth.users 
WHERE id = auth.uid()
ON CONFLICT (user_id) DO UPDATE SET
  openai_credits = 10000,
  elevenlabs_credits = 30000;

-- Verificar se o trigger handle_new_user existe e está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar o trigger melhorado para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir perfil do usuário se não existir
  INSERT INTO public.user_profiles (user_id, display_name, preferred_language)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email), 'pt-BR')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Inserir créditos iniciais com os novos valores
  INSERT INTO public.user_credits (user_id, openai_credits, elevenlabs_credits)
  VALUES (NEW.id, 10000, 30000)
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

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verificar se todos os usuários existentes têm perfis e créditos
INSERT INTO public.user_profiles (user_id, display_name, preferred_language)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'display_name', u.email),
  'pt-BR'
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_credits (user_id, openai_credits, elevenlabs_credits)
SELECT u.id, 10000, 30000
FROM auth.users u
LEFT JOIN public.user_credits c ON u.id = c.user_id
WHERE c.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;