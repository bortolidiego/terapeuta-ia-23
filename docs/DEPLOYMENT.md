# 🚀 Deploy e Ambientes

## Ambientes

| Ambiente | URL | Projeto Supabase | Status |
|----------|-----|-----------------|--------|
| **Desenvolvimento** | http://localhost:5173 | `kajrbruhcpaahhoitwtv` | ✅ Ativo |
| **Produção** | (Vercel/Netlify) | (a ser criado) | ⏳ Pendente |

> **Nota**: O ambiente local do Supabase foi desativado. Todo desenvolvimento usa o banco cloud.

## Configuração Inicial

### 1. Criar arquivo `.env`

```env
VITE_SUPABASE_URL=https://kajrbruhcpaahhoitwtv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sua_anon_key>
```

### 2. Linkar projeto ao CLI

```bash
supabase login
supabase link --project-ref kajrbruhcpaahhoitwtv
```

### 3. Configurar Secrets no Supabase

```bash
supabase secrets set OPENROUTER_API_KEY=<sua_key>
supabase secrets set ELEVENLABS_API_KEY=<sua_key>
supabase secrets set ASAAS_API_KEY=<sua_key>
supabase secrets set ASAAS_WEBHOOK_TOKEN=<token_seguro>
supabase secrets set ASAAS_SANDBOX=true
supabase secrets set RAPIDAPI_KEY=<sua_key>
```

### 4. Rodar Frontend
```bash
npm run dev
```

## Providers Configurados

| Funcionalidade | Provider | Variável |
|----------------|----------|----------|
| **LLM/Chat** | OpenRouter | `OPENROUTER_API_KEY` |
| **TTS + Clonagem de Voz** | ElevenLabs | `ELEVENLABS_API_KEY` |
| **Astrologia** | RapidAPI | `RAPIDAPI_KEY` |
| **Pagamentos** | Asaas | `ASAAS_API_KEY` |

## Deploy de Edge Functions

```bash
supabase functions deploy therapy-chat
supabase functions deploy protocol-executor
supabase functions deploy audio-assembly
supabase functions deploy asaas-webhook
supabase functions deploy asaas-create-charge
```

## Migrations

```bash
# Criar nova migration
supabase migration new nome_da_migration

# Aplicar ao cloud (DEV)
supabase db push
```

## Criar Ambiente de Produção

1. Acessar https://supabase.com/dashboard
2. Criar novo projeto para produção
3. Configurar variáveis de ambiente com URL e keys de produção
4. Deploy separado das Edge Functions

## Dashboard

- **Dev**: https://supabase.com/dashboard/project/kajrbruhcpaahhoitwtv
