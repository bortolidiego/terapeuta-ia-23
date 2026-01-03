-- CORREÇÃO CRÍTICA DE SEGURANÇA: Implementar RLS adequado para proteger dados de pacientes

-- 1. THERAPY_SESSIONS: Restringir acesso apenas ao proprietário da sessão
DROP POLICY IF EXISTS "Everyone can create sessions" ON public.therapy_sessions;
DROP POLICY IF EXISTS "Everyone can update their sessions" ON public.therapy_sessions; 
DROP POLICY IF EXISTS "Everyone can view their sessions" ON public.therapy_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.therapy_sessions;
DROP POLICY IF EXISTS "Users can view only their own sessions" ON public.therapy_sessions;
DROP POLICY IF EXISTS "Users can update only their own sessions" ON public.therapy_sessions;

-- Políticas seguras para therapy_sessions - apenas usuários autenticados podem acessar suas próprias sessões
CREATE POLICY "Users can create their own sessions" ON public.therapy_sessions
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view only their own sessions" ON public.therapy_sessions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update only their own sessions" ON public.therapy_sessions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. SESSION_MESSAGES: Proteger conversas de terapia - acesso apenas através de sessões próprias
DROP POLICY IF EXISTS "Everyone can create session messages" ON public.session_messages;
DROP POLICY IF EXISTS "Everyone can view session messages" ON public.session_messages;
DROP POLICY IF EXISTS "Users can create messages in their own sessions" ON public.session_messages;
DROP POLICY IF EXISTS "Users can view messages from their own sessions" ON public.session_messages;

-- Função para verificar se usuário é dono da sessão
CREATE OR REPLACE FUNCTION public.is_session_owner(session_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapy_sessions 
    WHERE id = session_uuid AND user_id = auth.uid()
  );
$$;

-- Políticas seguras para session_messages
CREATE POLICY "Users can create messages in their own sessions" ON public.session_messages
FOR INSERT TO authenticated
WITH CHECK (public.is_session_owner(session_id));

CREATE POLICY "Users can view messages from their own sessions" ON public.session_messages
FOR SELECT TO authenticated
USING (public.is_session_owner(session_id));

-- 3. THERAPY_FACTS: Proteger fatos extraídos de terapia
DROP POLICY IF EXISTS "Everyone can insert therapy_facts" ON public.therapy_facts;
DROP POLICY IF EXISTS "Everyone can update therapy_facts" ON public.therapy_facts;
DROP POLICY IF EXISTS "Everyone can view therapy_facts" ON public.therapy_facts;
DROP POLICY IF EXISTS "Users can create facts in their own sessions" ON public.therapy_facts;
DROP POLICY IF EXISTS "Users can view facts from their own sessions" ON public.therapy_facts;
DROP POLICY IF EXISTS "Users can update facts from their own sessions" ON public.therapy_facts;

-- Políticas seguras para therapy_facts
CREATE POLICY "Users can create facts in their own sessions" ON public.therapy_facts
FOR INSERT TO authenticated
WITH CHECK (public.is_session_owner(session_id));

CREATE POLICY "Users can view facts from their own sessions" ON public.therapy_facts
FOR SELECT TO authenticated
USING (public.is_session_owner(session_id));

CREATE POLICY "Users can update facts from their own sessions" ON public.therapy_facts
FOR UPDATE TO authenticated
USING (public.is_session_owner(session_id))
WITH CHECK (public.is_session_owner(session_id));

-- 4. USER_PROFILES: Proteger dados de perfil
DROP POLICY IF EXISTS "Everyone can view and manage profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- Políticas seguras para user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. USER_SENTIMENT_FILTERS: Proteger filtros de sentimentos pessoais
DROP POLICY IF EXISTS "Everyone can create sentiment filters" ON public.user_sentiment_filters;
DROP POLICY IF EXISTS "Everyone can view sentiment filters" ON public.user_sentiment_filters;
DROP POLICY IF EXISTS "Everyone can update sentiment filters" ON public.user_sentiment_filters;
DROP POLICY IF EXISTS "Everyone can delete sentiment filters" ON public.user_sentiment_filters;
DROP POLICY IF EXISTS "Authenticated users can manage their sentiment filters" ON public.user_sentiment_filters;

-- Políticas seguras para user_sentiment_filters (sem user_id, mas limitadas por autenticação)
CREATE POLICY "Authenticated users can manage their sentiment filters" ON public.user_sentiment_filters
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 6. KNOWLEDGE_BASE e SENTIMENTOS: Manter acesso público (dados não sensíveis)
-- Essas tabelas podem permanecer públicas pois contêm dados gerais, não dados pessoais de pacientes

-- 7. THERAPIST_CONFIG: Manter acesso público para funcionamento da aplicação
-- Esta tabela contém configurações gerais do sistema, não dados de pacientes