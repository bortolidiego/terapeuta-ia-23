-- FASE 1: Limpeza da Database - Protocolo Evento Traumático Específico

-- Remover fragmentos desnecessários da audio_components
DELETE FROM public.audio_components 
WHERE component_key IN (
  'base_completamente',
  'base_de_mim', 
  'base_em_mim',
  'base_liberto_agora',
  'base_para_sempre',
  'base_recebo_agora'
);

-- Adicionar fragmentos essenciais que faltam
INSERT INTO public.audio_components (component_key, component_type, text_content, protocol_type, is_available) VALUES
('base_todos_sentimentos_prejudiciais', 'base_word', 'TODOS OS SENTIMENTOS PREJUDICIAIS', 'evento_traumatico_especifico', true),
('base_que_recebi', 'base_word', 'que eu recebi', 'evento_traumatico_especifico', true),
('base_code_espirito', 'base_word', 'Código ESPÍRITO, a minha consciência escolhe', 'evento_traumatico_especifico', true),
('base_informacoes_prejudiciais_gerei', 'base_word', 'todas as informações prejudiciais que eu gerei', 'evento_traumatico_especifico', true),
('base_informacoes_prejudiciais_recebi', 'base_word', 'todas as informações prejudiciais que eu recebi', 'evento_traumatico_especifico', true)
ON CONFLICT (component_key) DO UPDATE SET
  text_content = EXCLUDED.text_content,
  is_available = EXCLUDED.is_available;

-- Remover tabela audio_templates (não é mais necessária)
DROP TABLE IF EXISTS public.audio_templates;