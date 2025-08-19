-- Limpar os comandos longos antigos do protocolo evento_traumatico_especifico
DELETE FROM audio_components WHERE protocol_type = 'evento_traumatico_especifico';

-- Inserir fragmentos base para protocolo evento_traumatico_especifico
INSERT INTO audio_components (component_key, component_type, text_content, protocol_type, is_available) VALUES
-- Fragmentos para sequência principal
('base_code_alma', 'base_word', 'Código alma, a minha consciência escolhe', 'evento_traumatico_especifico', true),
('base_que_senti', 'base_word', 'que eu senti', 'evento_traumatico_especifico', true),
('base_acabaram', 'base_word', 'acabaram!', 'evento_traumatico_especifico', true),

-- Fragmentos para sequências complementares
('base_recebo_agora', 'base_word', 'Recebo agora', 'evento_traumatico_especifico', true),
('base_em_mim', 'base_word', 'em mim', 'evento_traumatico_especifico', true),
('base_para_sempre', 'base_word', 'para sempre', 'evento_traumatico_especifico', true),

-- Fragmentos para sequência final
('base_liberto_agora', 'base_word', 'Liberto agora', 'evento_traumatico_especifico', true),
('base_de_mim', 'base_word', 'de mim', 'evento_traumatico_especifico', true),
('base_completamente', 'base_word', 'completamente', 'evento_traumatico_especifico', true),

-- Template para eventos (sempre gerado dinamicamente)
('event_template', 'event_placeholder', '{evento}', 'evento_traumatico_especifico', true);

-- Atualizar sentimentos para contexto plural português
UPDATE sentimentos SET 
  contexto = CASE 
    WHEN nome = 'raiva' THEN 'raivas que eu senti'
    WHEN nome = 'medo' THEN 'medos que eu senti'
    WHEN nome = 'tristeza' THEN 'tristezas que eu senti'
    WHEN nome = 'ansiedade' THEN 'ansiedades que eu senti'
    WHEN nome = 'culpa' THEN 'culpas que eu senti'
    WHEN nome = 'vergonha' THEN 'vergonhas que eu senti'
    WHEN nome = 'rejeição' THEN 'rejeições que eu senti'
    WHEN nome = 'abandono' THEN 'abandonos que eu senti'
    WHEN nome = 'solidão' THEN 'solidões que eu senti'
    WHEN nome = 'impotência' THEN 'impotências que eu senti'
    ELSE CONCAT(nome, 's que eu senti')
  END
WHERE contexto IS NULL OR contexto = '';