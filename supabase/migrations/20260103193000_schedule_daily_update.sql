-- =====================================================
-- AGENDAMENTO DA ATUALIZAÇÃO DIÁRIA
-- Migration: 20260103193000_schedule_daily_update
-- =====================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- 2. Função wrapper para fazer a chamada HTTP
-- Isso facilita trocar a URL dependendo do ambiente (dev/prod)
CREATE OR REPLACE FUNCTION public.trigger_daily_astro_update()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    project_url text;
    service_key text;
    request_id bigint;
BEGIN
    -- Tenta pegar de segredos (tabela vault) ou usa valor padrão/variável
    -- Como simplificação, vamos assumir que configuraremos esses secrets ou usaremos valores conhecidos.
    -- Em ambiente local Supabase, a URL padrão do Edge Function é:
    -- http://host.docker.internal:54321/functions/v1/cron-daily-update
    
    -- Para produção, seria: https://<PROJECT_REF>.supabase.co/functions/v1/cron-daily-update
    
    -- Vamos usar uma lógica dinâmica básica:
    -- Se tiver o secret 'app_edge_url', usa ele. Senão, tenta inferir.
    
    -- NOTA: pg_net requer que a URL seja acessível da rede do banco.
    
    -- URL FIXA PARA ESTE AMBIENTE (Pode ser ajustada depois)
    -- Ajuste esta URL conforme seu ambiente (Local vs Produção)
    project_url := current_setting('app.edge_url', true);
    IF project_url IS NULL OR project_url = '' THEN
        -- Fallback para URL local interna do Docker (padrão Supabase CLI)
        project_url := 'http://edge_runtime:54321/functions/v1/cron-daily-update';
    END IF;

    service_key := current_setting('app.service_key', true);
    IF service_key IS NULL OR service_key = '' THEN
        -- IMPORTANTE: Em produção, você DEVE configurar app.service_key via:
        -- ALTER DATABASE postgres SET app.service_key = 'sk_...';
        -- Por enquanto, usaremos um placeholder que precisa ser substituído ou configurado
        service_key := 'SERVICE_ROLE_KEY_HERE'; 
    END IF;

    -- Fazer a chamada POST
    SELECT net.http_post(
        url := project_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        ),
        body := '{}'::jsonb
    ) INTO request_id;

    RETURN jsonb_build_object('success', true, 'request_id', request_id);
END;
$$;

-- 3. Agendar o Cron Job (apenas se não existir)
-- Roda todo dia às 06:05 da manhã (UTC)
SELECT cron.schedule(
    'daily-astro-update',
    '5 6 * * *', 
    $$
    SELECT public.trigger_daily_astro_update();
    $$
);

-- Comentários
COMMENT ON FUNCTION public.trigger_daily_astro_update IS 'Dispara a Edge Function cron-daily-update via pg_net.';
