# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.4.0] - 2026-01-03

### ✨ Adicionado
- **Controle de Privacidade Avançado**: Nova aba de privacidade no perfil com ferramentas granulares de exclusão.
- **Exclusão de Voz e Áudios**: Opção para remover perfil de voz clonada e limpar a biblioteca de áudios gerados.
- **Exclusão de Fatos IA**: Capacidade de apagar o conhecimento acumulado pela IA sobre o usuário (`therapy_facts`).
- **Encerramento de Conta**: Funcionalidade completa de "Direito ao Esquecimento" que apaga perfil, dados astrológicos, histórico e encerra a conta.
- **Estatísticas Detalhadas**: Visualização de contagem de Mensagens, Sessões, Sentimentos, Áudios e Fatos IA conhecidos.

### 🔒 Segurança
- **Confirmação por Digitação**: Todas as ações de exclusão agora exigem confirmação digitada (`EXCLUIR` ou `EXCLUIR CONTA DEFINITIVAMENTE`), seguindo padrões de segurança do Supabase.
- **Proteção de Dados Base**: Lógica de exclusão de sentimentos preserva agora os sentimentos padrão do sistema (`base_contexto`).

### 🔧 Técnico
- **Limpeza Multitabela**: Implementação de fluxos de deleção cascata manual para garantir que nenhum dado sensível permaneça em tabelas auxiliares (`assembly_jobs`, `autocura_analytics`, etc).
- **Integração com Auth**: Fluxo de deleção de conta agora inclui `signOut` e redirecionamento de segurança.

---

## [1.3.0] - 2026-01-03

### ✨ Adicionado
- **Integração Completa de Astrologia**: Implementação de todos os principais pontos astrológicos via RapidAPI.
  - **Novos Pontos**: Lilith (Lua Negra), Nodo Norte, Parte da Fortuna e Meio do Céu (MC).
  - **Cúspides das 12 Casas**: Visualização detalhada de todas as casas e seus signos.
  - **Detalhes Planetários**: Exibição de graus, minutos, indicador de retrógrado (_℞_) e dignidades (Domicílio, Exaltação, etc.).
  - **Distribuições Energéticas**: Gráficos percentuais para Elementos (Fogo/Terra/Ar/Água), Qualidades (Cardinal/Fixo/Mutável) e Polaridade (Yang/Yin).
  - **Aspectos Completos**: Inclusão de todos os aspectos planetários formados.

### 🔧 Técnico
- **Migrations via MCP**: Resolução de conflitos de banco de dados utilizando MCP Supabase Server para aplicar migrations diretamente.
- **Schema Estendido**: Adição de colunas JSONB (`house_cusps`, `planet_positions`, `distributions`) na tabela `user_astro_data`.
- **Edge Function Refatorada**: Reescrita completa da função `astro-chart` para processamento avançado de dados astrológicos.

---

## [1.2.0] - 2026-01-03

### ✨ Adicionado
- **Mapa Astral Completo**: Inclusão de Quíron (Ferida Sagrada) e Saturno (Limitações) na visualização.
- **Geocodificação Precisa**: Novo componente `CityAutocomplete` integrado ao Nominatim (OpenStreetMap) para busca global de cidades.
- **Armazenamento de Coordenadas**: Campos `birth_latitude` e `birth_longitude` no perfil para cálculos astronômicos precisos.
- **Seleção de Horário Intuitiva**: Novos seletores dedicados para Hora e Minuto com formato 24h claro.
- **Notificação de Atualização**: Banner de destaque fixo no topo com botão "Atualizar Agora" para novas versões.

### 🐛 Corrigido
- **Bug da Meia-Noite**: Corrigido erro onde hora "00:xx" era interpretada como meio-dia ("12:xx") no cálculo do mapa.
- **Extração de Dados da API**: Ajuste para garantir que planetas terapêuticos (Quíron, Saturno) sejam sempre retornados pela API.
- **Contexto do Terapeuta**: Correção para garantir que o assistente receba o contexto astrológico completo (incluindo trânsitos e aspectos).

### 🗑️ Removido
- **Menu Admin**: Removido o botão e página de administração (`/admin`) do sistema.
- Arquivos removidos: `AdminPanel.tsx`, `Admin.tsx`.

### 🔧 Técnico
- Otimização da Edge Function `astro-chart` com fallback inteligente (usa coordenadas salvas se disponíveis).
- Validação reforçada nos campos de data, hora e cidade antes do cálculo.
- Inclusão dos campos `chiron_sign` e `saturn_sign` na resposta da API `astro-chart`.

---

### ✨ Adicionado
- Sistema de créditos com histórico por provider (LLM/Voz)
- Página de regras de audição `/regras-audicao`
- Modal de regras de audição (`AudioRulesModal`)
- Economia de cache visível na página de créditos
- Tabs de filtro no histórico de uso (Todos/LLM/Voz)
- Edge Functions para Asaas (`asaas-webhook`, `asaas-create-charge`)
- Componente `CreditCheckout` com seleção de pacotes e pagamento
- Modal de pagamento PIX com QR Code e copia-cola
- Tabela `credit_purchases` para histórico de compras
- Componente de badge de versão (`VersionBadge`)
- Notificação de nova versão com botão "Atualizar"
- Dialog para visualizar changelog
- Hook `useVersion` para gerenciar versão e detectar atualizações
- Documentação completa em `/docs`:
  - `README.md` - Índice da documentação
  - `ARCHITECTURE.md` - Arquitetura do sistema
  - `DESIGN.md` - Guia de design
  - `API.md` - Documentação das Edge Functions
  - `DATABASE.md` - Schema do banco
  - `DEPLOYMENT.md` - Guia de deploy
- `CONTRIBUTING.md` com regras de commit
- Workflow `/commit-documentation` para padronização

### 🔄 Alterado
- Nomenclatura de créditos: OpenAI → LLM, ElevenLabs → Voz
- Preparação para migração de ElevenLabs para VoiceKiller
- `package.json` atualizado: nome para `terapeuta-ia`, versão 1.0.0

### 🔧 Técnico
- Refatoração do `Credits.tsx` para suportar múltiplos providers
- `public/version.json` para controle de versão no frontend
- Estruturação profissional de documentação

---

## [0.9.0] - 2025-12-XX

### ✨ Adicionado
- Protocolo de Transformação Emocional Específica (TEE)
- Sistema de montagem de áudio em background
- Cache de fragmentos de áudio (economia TTS)
- Clonagem de voz com ElevenLabs
- Popup de seleção de sentimentos com filtros
- Geração de sentimentos via IA (OpenRouter)

### 🔧 Técnico
- Edge Functions: `protocol-executor`, `audio-assembly`, `generate-sentiments`
- Tabelas: `assembly_jobs`, `audio_fragments_cache`, `sentimentos`

---

## Tipos de Mudança

- ✨ **Adicionado** - para novas funcionalidades
- 🔄 **Alterado** - para mudanças em funcionalidades existentes
- ⚠️ **Depreciado** - para funcionalidades que serão removidas
- 🗑️ **Removido** - para funcionalidades removidas
- 🐛 **Corrigido** - para correções de bugs
- 🔒 **Segurança** - para correções de vulnerabilidades
- 🔧 **Técnico** - para mudanças internas/refatorações
