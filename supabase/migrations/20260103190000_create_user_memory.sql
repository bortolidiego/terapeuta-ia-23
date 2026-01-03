-- =====================================================
-- MEMÓRIA DE LONGO PRAZO DO USUÁRIO
-- Migration: 20260103190000_create_user_memory
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE SET NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('summary', 'insight', 'preference', 'fact')),
    content TEXT NOT NULL,
    relevance_score INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON public.user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON public.user_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_created_at ON public.user_memory(created_at);

-- RLS Policies
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memories"
    ON public.user_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
    ON public.user_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
    ON public.user_memory FOR UPDATE
    USING (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE public.user_memory IS 'Tabela para armazenar contexto de longo prazo do usuário (resumos de sessões, insights, preferências).';
COMMENT ON COLUMN public.user_memory.memory_type IS 'Tipo de memória: summary (resumo de sessão), insight (descoberta importante), preference (preferência do usuário), fact (fato sobre a vida do usuário).';
