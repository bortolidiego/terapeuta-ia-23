-- =====================================================
-- METODOLOGIA COMPLETA DE AUTOCURA - SCHEMA
-- Migration: 20260101153500_complete_autocura_schema
-- =====================================================

-- 1. Tipos de Protocolo Disponíveis
CREATE TABLE IF NOT EXISTS public.protocol_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'transformacao_emocional',
    'transformacao_mental', 
    'sequencia',
    'desconexao',
    'limpeza',
    'programacao',
    'especial'
  )),
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'daily', 'eventual')),
  description TEXT,
  requires_sentiments BOOLEAN DEFAULT false,
  requires_event BOOLEAN DEFAULT false,
  requires_target_person BOOLEAN DEFAULT false,
  requires_theme BOOLEAN DEFAULT false,
  command_count INTEGER,
  example_phrase TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Pendências para Próximas Sessões
CREATE TABLE IF NOT EXISTS public.pending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  topic_type TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Protocolos Gerados para o Usuário
CREATE TABLE IF NOT EXISTS public.user_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  protocol_type_key TEXT NOT NULL REFERENCES public.protocol_types(key),
  name TEXT NOT NULL,
  event_description TEXT,
  sentiments TEXT[],
  target_person TEXT,
  theme TEXT,
  commands JSONB NOT NULL DEFAULT '[]'::jsonb,
  command_count INTEGER DEFAULT 0,
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'daily', 'eventual')),
  activation_count INTEGER DEFAULT 0,
  last_activated_at TIMESTAMPTZ,
  audio_path TEXT,
  audio_status TEXT DEFAULT 'pending' CHECK (audio_status IN ('pending', 'processing', 'completed', 'failed')),
  is_in_procedure BOOLEAN DEFAULT false,
  procedure_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Procedimentos (Agrupamento de Comandos)
CREATE TABLE IF NOT EXISTS public.user_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'eventual')),
  eventual_trigger TEXT,
  protocol_ids UUID[],
  activation_count INTEGER DEFAULT 0,
  activated_1000x BOOLEAN DEFAULT false,
  activated_1000x_at TIMESTAMPTZ,
  audio_path TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activated_at TIMESTAMPTZ
);

-- 5. Grupos de Sentimentos Salvos
CREATE TABLE IF NOT EXISTS public.sentiment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sentiments TEXT[] NOT NULL,
  context TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Dados do Mapa Astral do Usuário
CREATE TABLE IF NOT EXISTS public.user_astro_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date DATE NOT NULL,
  birth_time TIME,
  birth_city TEXT NOT NULL,
  birth_country TEXT DEFAULT 'Brasil',
  birth_latitude DECIMAL(9,6),
  birth_longitude DECIMAL(9,6),
  astro_chart JSONB,
  sun_sign TEXT,
  moon_sign TEXT,
  rising_sign TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Insights Astrológicos por Sessão
CREATE TABLE IF NOT EXISTS public.session_astro_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  insights JSONB NOT NULL DEFAULT '{}'::jsonb,
  transit_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pending_topics_user_status ON public.pending_topics(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_topics_priority ON public.pending_topics(priority DESC);
CREATE INDEX IF NOT EXISTS idx_user_protocols_user ON public.user_protocols(user_id);
CREATE INDEX IF NOT EXISTS idx_user_protocols_frequency ON public.user_protocols(frequency);
CREATE INDEX IF NOT EXISTS idx_user_protocols_type ON public.user_protocols(protocol_type_key);
CREATE INDEX IF NOT EXISTS idx_user_procedures_user ON public.user_procedures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_procedures_frequency ON public.user_procedures(frequency);
CREATE INDEX IF NOT EXISTS idx_sentiment_groups_user ON public.sentiment_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_types_category ON public.protocol_types(category);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.protocol_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_astro_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_astro_insights ENABLE ROW LEVEL SECURITY;

-- Protocol types são públicos (leitura)
CREATE POLICY "Anyone can read protocol_types" ON public.protocol_types FOR SELECT USING (true);

-- Pending topics
CREATE POLICY "Users can view own pending_topics" ON public.pending_topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pending_topics" ON public.pending_topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending_topics" ON public.pending_topics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pending_topics" ON public.pending_topics FOR DELETE USING (auth.uid() = user_id);

-- User protocols
CREATE POLICY "Users can view own protocols" ON public.user_protocols FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own protocols" ON public.user_protocols FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own protocols" ON public.user_protocols FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own protocols" ON public.user_protocols FOR DELETE USING (auth.uid() = user_id);

-- User procedures
CREATE POLICY "Users can view own procedures" ON public.user_procedures FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own procedures" ON public.user_procedures FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own procedures" ON public.user_procedures FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own procedures" ON public.user_procedures FOR DELETE USING (auth.uid() = user_id);

-- Sentiment groups
CREATE POLICY "Users can view own sentiment_groups" ON public.sentiment_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sentiment_groups" ON public.sentiment_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sentiment_groups" ON public.sentiment_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sentiment_groups" ON public.sentiment_groups FOR DELETE USING (auth.uid() = user_id);

-- User astro data
CREATE POLICY "Users can view own astro_data" ON public.user_astro_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own astro_data" ON public.user_astro_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own astro_data" ON public.user_astro_data FOR UPDATE USING (auth.uid() = user_id);

-- Session astro insights (usuários podem ver insights de suas sessões)
CREATE POLICY "Users can view own session insights" ON public.session_astro_insights FOR SELECT USING (true);
CREATE POLICY "Service role can manage session insights" ON public.session_astro_insights FOR ALL USING (true);

-- =====================================================
-- SEED: TIPOS DE PROTOCOLO DA METODOLOGIA
-- =====================================================

INSERT INTO public.protocol_types (key, name, category, frequency, description, requires_sentiments, requires_event, requires_target_person, requires_theme, command_count, example_phrase, sort_order) VALUES

-- TRANSFORMAÇÕES EMOCIONAIS
('tee', 'Transformação Emocional Específica', 'transformacao_emocional', 'once', 
 'Eventos únicos na vida. Levanta sentimentos e elimina com Código ALMA.', 
 true, true, false, false, NULL, 
 'Código ALMA, a minha consciência escolhe: [sentimento] que eu senti [evento], ACABARAM!', 1),

('ter', 'Transformação Emocional Recorrente', 'transformacao_emocional', 'daily', 
 'Eventos que se repetem. Formato: "Todas as vezes que..."', 
 true, true, false, false, NULL, 
 'Código ALMA, a minha consciência escolhe: [sentimento] que eu senti todas as vezes que [evento], ACABARAM!', 2),

('privacoes', 'Privações', 'transformacao_emocional', 'daily', 
 'O que está se privando por conta dos problemas.', 
 true, false, false, true, NULL, 
 'Código ALMA, a minha consciência escolhe: [sentimento] que eu senti por [privação], ACABARAM!', 3),

-- TRANSFORMAÇÕES MENTAIS
('condicionamentos', 'Condicionamentos', 'transformacao_mental', 'daily', 
 'Padrões de pensar, sentir, reagir, observar.', 
 false, false, false, true, 1, 
 'Código ESPÍRITO, a minha consciência escolhe: condicionamentos de [padrão] ACABARAM!', 4),

('crencas', 'Crenças', 'transformacao_mental', 'daily', 
 'Ideias dos outros que incomodam.', 
 false, false, true, true, 1, 
 'Código ESPÍRITO, a minha consciência escolhe: crenças de que [ideia] ACABARAM!', 5),

('hereditariedades', 'Hereditariedades', 'transformacao_mental', 'daily', 
 'Padrões herdados de pais, mães, avós.', 
 false, false, false, true, 1, 
 'Código ESPÍRITO, a minha consciência escolhe: hereditariedades recebidas de [padrão] ACABARAM!', 6),

-- SEQUÊNCIAS
('sequencia_generica', 'Sequência Genérica', 'sequencia', 'daily', 
 '24 comandos para eliminar um tema amplo (dívidas, obesidade, etc.)', 
 false, false, false, true, 24, 
 '24 comandos com ALMA, ESPÍRITO e CORPO para o tema', 7),

('sequencia_dependencia', 'Sequência da Dependência', 'sequencia', 'daily', 
 '4 comandos para compulsões: Prazeres, Desejos, Apegos, Dependências.', 
 false, false, false, true, 4, 
 'Código ALMA: prazeres/desejos/apegos/dependências que senti por [compulsão] ACABARAM!', 8),

-- DESCONEXÕES
('desconexao_parcial', 'Desconexão Parcial', 'desconexao', 'daily', 
 'Cortar emaranhamentos NEGATIVOS com uma pessoa.', 
 false, false, true, false, 3, 
 'Código [ALMA/ESPÍRITO/CORPO]: emaranhamentos NEGATIVOS com a consciência de [pessoa] ACABARAM!', 9),

('desconexao_total', 'Desconexão Total', 'desconexao', 'once', 
 'Cortar emaranhamento TOTAL com uma pessoa.', 
 false, false, true, false, 3, 
 'Código [ALMA/ESPÍRITO/CORPO]: emaranhamentos com a consciência de [pessoa] ACABARAM!', 10),

('desconexao_fora_materia', 'Desconexão Fora da Matéria', 'desconexao', 'eventual', 
 'Desconectar de consciências desencarnadas. Usar em ataques espirituais ou mal súbito.', 
 false, false, false, false, 7, 
 '7 comandos para desconectar de consciências negativas e emaranhar com positivas', 11),

-- LIMPEZAS
('limpeza_pos_desconexao', 'Limpeza Após Desconexão', 'limpeza', 'eventual', 
 'Limpar após conexão com pessoas. Usar após conversas, reuniões, encontros.', 
 false, false, true, true, 6, 
 'Código [ALMA/ESPÍRITO/CORPO]: sentimentos/informações prejudiciais durante conexão com [pessoa] ACABARAM!', 12),

('limpeza_diaria', 'Limpeza Diária', 'limpeza', 'daily', 
 'Fazer antes de dormir. Limpa todos os sentimentos e informações prejudiciais do dia.', 
 false, false, false, false, 6, 
 'Código [ALMA/ESPÍRITO/CORPO]: sentimentos/informações prejudiciais que eu senti/gerei/recebi hoje ACABARAM!', 13),

-- PROGRAMAÇÕES
('programacao_emocional', 'Programação Emocional', 'programacao', 'daily', 
 'Programar estados emocionais desejados.', 
 false, false, false, true, 1, 
 'Código ALMA: eu sou fonte de [paz, tranquilidade, prosperidade]', 14),

('programacao_mental', 'Programação Mental', 'programacao', 'daily', 
 'Fortalecer novos padrões mentais.', 
 false, false, false, true, 1, 
 'Código ESPÍRITO: condicionamentos de [prosperar] se fortalecem', 15),

('programacao_material', 'Programação Material', 'programacao', 'daily', 
 'Decretar situações de vida desejadas.', 
 false, false, false, true, 3, 
 'Código [ALMA/ESPÍRITO/CORPO]: eu já [tenho minha casa dos sonhos]', 16),

-- ESPECIAIS
('periodo_inconsciente', 'Período Inconsciente', 'especial', 'once', 
 'Eliminar conteúdos da concepção até a primeira infância. Uma vez na vida.', 
 true, false, false, false, 15, 
 '15 comandos para raivas, medos, tristezas, etc. do primeiro dia de existência até primeira infância', 17),

('desintoxicacao_quantica', 'Desintoxicação Quântica', 'especial', 'daily', 
 'Eliminar excesso de metais tóxicos, parasitas, toxinas, cortisol.', 
 false, false, false, true, 3, 
 'Código [ALMA/ESPÍRITO/CORPO]: excesso de [metais tóxicos] no meu corpo ACABARAM!', 18),

('antes_ingerir_substancias', 'Antes de Ingerir Substâncias', 'especial', 'eventual', 
 'Limpar remédios, alimentos antes de ingerir.', 
 false, false, false, true, 6, 
 'Código [ALMA/ESPÍRITO/CORPO]: informações prejudiciais deste [remédio] ACABARAM + é saudável', 19),

('gerar_substancias', 'Gerar Substâncias no Corpo', 'especial', 'daily', 
 'Gerar serotonina, dopamina, etc.', 
 false, false, false, true, 3, 
 'Código [ALMA/ESPÍRITO/CORPO]: eu absorvo informações positivas de [serotonina] na quantidade ideal', 20)

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  command_count = EXCLUDED.command_count,
  example_phrase = EXCLUDED.example_phrase;

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================
COMMENT ON TABLE public.protocol_types IS 'Tipos de protocolo disponíveis na metodologia de autocura';
COMMENT ON TABLE public.pending_topics IS 'Assuntos pendentes para próximas sessões de terapia';
COMMENT ON TABLE public.user_protocols IS 'Protocolos gerados para cada usuário durante as sessões';
COMMENT ON TABLE public.user_procedures IS 'Procedimentos (agrupamentos de protocolos) para ativação diária ou eventual';
COMMENT ON TABLE public.sentiment_groups IS 'Grupos de sentimentos salvos para reutilização';
COMMENT ON TABLE public.user_astro_data IS 'Dados do mapa astral do usuário para contexto nas sessões';
COMMENT ON TABLE public.session_astro_insights IS 'Insights astrológicos gerados para cada sessão';
