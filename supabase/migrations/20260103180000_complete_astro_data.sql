-- =====================================================
-- MAPA ASTRAL COMPLETO - Dados Adicionais
-- Migration: 20260103180000_complete_astro_data
-- =====================================================

-- Adicionar campos para dados astrológicos completos
ALTER TABLE public.user_astro_data 
ADD COLUMN IF NOT EXISTS lilith_sign TEXT,
ADD COLUMN IF NOT EXISTS north_node_sign TEXT,
ADD COLUMN IF NOT EXISTS fortune_sign TEXT,
ADD COLUMN IF NOT EXISTS mc_sign TEXT,
ADD COLUMN IF NOT EXISTS house_cusps JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS planet_positions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS element_distribution JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS quality_distribution JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS polarity_distribution JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS retrograde_planets TEXT[],
ADD COLUMN IF NOT EXISTS planetary_dignities JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS all_aspects JSONB DEFAULT '[]'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.user_astro_data.lilith_sign IS 'Signo da Lilith Média (Lua Negra)';
COMMENT ON COLUMN public.user_astro_data.north_node_sign IS 'Signo do Nodo Norte (Nodo Lunar Verdadeiro)';
COMMENT ON COLUMN public.user_astro_data.fortune_sign IS 'Signo da Parte da Fortuna';
COMMENT ON COLUMN public.user_astro_data.mc_sign IS 'Signo do Meio do Céu (MC)';
COMMENT ON COLUMN public.user_astro_data.house_cusps IS 'Cúspides das 12 casas astrológicas com signo e grau';
COMMENT ON COLUMN public.user_astro_data.planet_positions IS 'Posições completas dos planetas com graus, minutos, casas e retrógrado';
COMMENT ON COLUMN public.user_astro_data.element_distribution IS 'Distribuição percentual dos elementos (Fogo, Terra, Ar, Água)';
COMMENT ON COLUMN public.user_astro_data.quality_distribution IS 'Distribuição percentual das qualidades (Cardinal, Fixo, Mutável)';
COMMENT ON COLUMN public.user_astro_data.polarity_distribution IS 'Distribuição percentual da polaridade (Yang/Ativo, Yin/Reativo)';
COMMENT ON COLUMN public.user_astro_data.retrograde_planets IS 'Lista de planetas em movimento retrógrado';
COMMENT ON COLUMN public.user_astro_data.planetary_dignities IS 'Dignidades planetárias (domicílio, exaltação, exílio, queda)';
COMMENT ON COLUMN public.user_astro_data.all_aspects IS 'Todos os aspectos planetários (conjunção, oposição, trígono, quadratura, sextil, quincúncio)';
