-- Adicionar o componente base_minha_consciencia_escolhe que estava faltando
INSERT INTO audio_components (component_key, component_type, text_content, protocol_type, is_available)
VALUES ('base_minha_consciencia_escolhe', 'base_word', 'a minha consciência escolhe', 'evento_traumatico_especifico', true)
ON CONFLICT (component_key) DO UPDATE SET
  text_content = EXCLUDED.text_content,
  is_available = EXCLUDED.is_available;