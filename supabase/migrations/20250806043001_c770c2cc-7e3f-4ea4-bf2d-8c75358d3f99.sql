-- Add unique constraint to sentimentos table to enable upsert functionality
ALTER TABLE public.sentimentos ADD CONSTRAINT sentimentos_nome_key UNIQUE (nome);