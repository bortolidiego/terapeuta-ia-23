-- CORREÇÃO: Migrar arquivos existentes para nova estrutura com user_id
-- Atualizar paths dos assembly jobs existentes para incluir user_id
UPDATE assembly_jobs 
SET result_audio_path = user_id || '/' || result_audio_path
WHERE result_audio_path IS NOT NULL 
  AND result_audio_path NOT LIKE '%/%/%'  -- Evitar duplicar user_id se já estiver correto
  AND status = 'completed';

-- Criar função para migração de arquivos no storage (será executada pelo sistema)
CREATE OR REPLACE FUNCTION migrate_assembly_audio_paths()
RETURNS TABLE (
  job_id uuid,
  old_path text,
  new_path text,
  migration_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record record;
  old_audio_path text;
  new_audio_path text;
BEGIN
  -- Buscar todos os jobs com paths antigos
  FOR job_record IN 
    SELECT aj.id, aj.user_id, aj.result_audio_path 
    FROM assembly_jobs aj
    WHERE aj.result_audio_path IS NOT NULL
      AND aj.result_audio_path LIKE 'assembly-results/%'
      AND aj.result_audio_path NOT LIKE '%/%/%/%'  -- Não incluir paths já corrigidos
      AND aj.status = 'completed'
  LOOP
    old_audio_path := job_record.result_audio_path;
    new_audio_path := job_record.user_id || '/' || old_audio_path;
    
    -- Retornar informação sobre a migração necessária
    job_id := job_record.id;
    old_path := old_audio_path;
    new_path := new_audio_path;
    migration_status := 'needs_migration';
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;