-- Corrigir políticas permissivas demais

-- 1. USER_SENTIMENT_FILTERS: Atualmente qualquer usuário pode fazer qualquer coisa
-- Vamos assumir que não há user_id nesta tabela, então todos os filtros são compartilhados
DROP POLICY IF EXISTS "Authenticated users can manage their sentiment filters" ON public.user_sentiment_filters;

-- Como não há user_id, permitir apenas leitura para usuários autenticados
-- E apenas service_role pode gerenciar (criar/atualizar/deletar)
CREATE POLICY "Users can view sentiment filters" ON public.user_sentiment_filters
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can manage sentiment filters" ON public.user_sentiment_filters
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 2. SENTIMENTOS: Remover política permissiva para service_role e usar apenas a de leitura
DROP POLICY IF EXISTS "System can manage sentimentos" ON public.sentimentos;

-- Manter apenas leitura para usuários e permitir que edge functions atualizem contadores
CREATE POLICY "System can update sentimentos usage" ON public.sentimentos
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "System can insert sentimentos" ON public.sentimentos
FOR INSERT TO service_role
WITH CHECK (true);