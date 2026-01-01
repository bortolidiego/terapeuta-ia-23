# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-01-01

### ✨ Adicionado
- Sistema de créditos com histórico por provider (LLM/Voz)
- Página de regras de audição `/regras-audicao`
- Modal de regras de audição (`AudioRulesModal`)
- Economia de cache visível na página de créditos
- Tabs de filtro no histórico de uso (Todos/LLM/Voz)
- Edge Functions para Asaas (`asaas-webhook`, `asaas-create-charge`)
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
