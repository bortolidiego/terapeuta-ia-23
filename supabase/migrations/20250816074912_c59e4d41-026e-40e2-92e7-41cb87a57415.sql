-- Completar os templates ALMA faltantes
INSERT INTO audio_templates (template_key, template_text) VALUES
('quantum_alma_senti', 'Código ALMA, a minha consciência escolhe: [SENTIMENT] que eu senti [EVENT], ACABARAM!'),
('quantum_alma_recebi', 'Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi [EVENT], ACABARAM!'),
('quantum_alma_senti_geral', 'Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti [EVENT], ACABARAM!')
ON CONFLICT (template_key) DO UPDATE SET
template_text = EXCLUDED.template_text;

-- Completar os templates ESPÍRITO faltantes
INSERT INTO audio_templates (template_key, template_text) VALUES
('quantum_espirito_gerou_completo', 'Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei [EVENT], ACABARAM!'),
('quantum_espirito_recebi_completo', 'Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi [EVENT], ACABARAM!')
ON CONFLICT (template_key) DO UPDATE SET
template_text = EXCLUDED.template_text;