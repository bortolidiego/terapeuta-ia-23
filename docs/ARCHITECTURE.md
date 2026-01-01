# 🏛️ Arquitetura do Sistema

## Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React + TypeScript + Vite + Tailwind + shadcn/ui           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Auth          │   Database      │   Storage               │
│   (Users)       │   (PostgreSQL)  │   (Áudios/Arquivos)     │
├─────────────────┴─────────────────┴─────────────────────────┤
│                    Edge Functions                            │
│   therapy-chat | protocol-executor | audio-assembly | etc    │
└─────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROVIDERS EXTERNOS                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   OpenRouter    │   VoiceKiller   │   Asaas                 │
│   (LLM)         │   (TTS/Clone)   │   (Pagamentos)          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Frontend | React | 18.3.x |
| Bundler | Vite | 5.4.x |
| Estilização | Tailwind CSS | 3.4.x |
| Componentes | shadcn/ui | - |
| State | TanStack Query | 5.x |
| Backend | Supabase Edge Functions | Deno |
| Banco | PostgreSQL | 15 |
| Auth | Supabase Auth | - |

## Fluxos Principais

### 1. Sessão de Terapia
```mermaid
sequenceDiagram
    User->>Frontend: Inicia sessão
    Frontend->>therapy-chat: Envia mensagem
    therapy-chat->>OpenRouter: Processa com IA
    OpenRouter-->>therapy-chat: Resposta
    therapy-chat-->>Frontend: Exibe resposta
```

### 2. Protocolo de Autocura
```mermaid
sequenceDiagram
    User->>Frontend: Confirma protocolo
    Frontend->>protocol-executor: Gera comandos
    protocol-executor->>audio-assembly: Inicia montagem
    audio-assembly->>VoiceKiller: TTS
    VoiceKiller-->>audio-assembly: Áudio
    audio-assembly->>Storage: Salva MP3
    audio-assembly-->>User: Notificação
```

### 3. Compra de Créditos
```mermaid
sequenceDiagram
    User->>Frontend: Escolhe pacote
    Frontend->>asaas-create-charge: Cria cobrança
    asaas-create-charge->>Asaas: Gera PIX/Boleto
    Asaas-->>Frontend: QR Code/Link
    User->>Asaas: Paga
    Asaas->>asaas-webhook: Confirma
    asaas-webhook->>DB: Credita usuário
```

## Banco de Dados

### Tabelas Principais
- `profiles` - Dados do usuário
- `therapy_sessions` - Sessões de terapia
- `session_messages` - Mensagens do chat
- `user_credits` - Saldo de créditos
- `usage_tracking` - Histórico de consumo
- `assembly_jobs` - Jobs de montagem de áudio
- `audio_fragments_cache` - Cache de TTS
- `sentimentos` - Base de sentimentos

## Segurança

- JWT via Supabase Auth
- RLS (Row Level Security) em todas tabelas
- Edge Functions com validação de token
- API keys em variáveis de ambiente
