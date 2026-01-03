-- Adicionar campo birth_time e birth_country (se não existir) para integração com RapidAPI
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS birth_time TIME;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS birth_country TEXT DEFAULT 'Brasil';

-- Garantir que a tabela user_astro_data tenha birth_time como TIME (já que na migration anterior estava como TIME)
-- Mas vou adicionar um comentário para documentação
COMMENT ON COLUMN public.user_profiles.birth_time IS 'Hora de nascimento do usuário para cálculo do mapa astral';
