-- CORREÇÕES FINAIS DE SEGURANÇA: Proteger tabelas de configuração do sistema

-- 1. THERAPIST_CONFIG: Proteger configurações do sistema de IA
DROP POLICY IF EXISTS "Everyone can insert therapist config" ON public.therapist_config;
DROP POLICY IF EXISTS "Everyone can update therapist config" ON public.therapist_config;
DROP POLICY IF EXISTS "Everyone can view therapist config" ON public.therapist_config;

-- Apenas o sistema pode acessar configurações (sem políticas = apenas service role)
-- Isso significa que apenas edge functions podem modificar essas configurações

-- 2. KNOWLEDGE_BASE: Proteger base de conhecimento terapêutico  
DROP POLICY IF EXISTS "Everyone can manage knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Everyone can view knowledge base" ON public.knowledge_base;

-- Apenas o sistema pode gerenciar a base de conhecimento
-- Edge functions podem acessar para fornecer conteúdo aos usuários

-- 3. SENTIMENTOS: Proteger dados de sentimentos (mantém leitura para funcionalidade)
DROP POLICY IF EXISTS "Everyone can create sentimentos" ON public.sentimentos;
DROP POLICY IF EXISTS "Everyone can update sentimentos" ON public.sentimentos;
DROP POLICY IF EXISTS "Everyone can view sentimentos" ON public.sentimentos;

-- Permitir apenas leitura para usuários autenticados (necessário para funcionalidade)
-- Apenas o sistema pode criar/atualizar sentimentos
CREATE POLICY "Authenticated users can view sentimentos" ON public.sentimentos
FOR SELECT TO authenticated
USING (true);

-- Usuários autenticados podem incrementar contadores de uso (função específica)
CREATE POLICY "System can manage sentimentos" ON public.sentimentos
FOR ALL TO service_role
USING (true)
WITH CHECK (true);