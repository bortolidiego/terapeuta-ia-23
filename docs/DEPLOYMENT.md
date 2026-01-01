# 🚀 Deploy e Ambientes

## Ambientes

| Ambiente | URL | Banco |
|----------|-----|-------|
| Local | http://localhost:5173 | Supabase Local |
| Produção | (Vercel/Netlify) | vjwewfxcbdxtjwhwofzn.supabase.co |

## Desenvolvimento Local

### 1. Iniciar Supabase Local
```bash
cd terapeuta-ia-23
supabase start
```

### 2. Configurar .env.local
```env
VITE_SUPABASE_URL="http://127.0.0.1:54331"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Rodar Frontend
```bash
npm run dev
```

## Deploy para Produção

### 1. Atualizar versão
```bash
# Editar package.json e public/version.json
# Atualizar docs/CHANGELOG.md
```

### 2. Build
```bash
npm run build
```

### 3. Deploy Edge Functions
```bash
supabase functions deploy therapy-chat
supabase functions deploy protocol-executor
supabase functions deploy audio-assembly
supabase functions deploy asaas-webhook
supabase functions deploy asaas-create-charge
```

### 4. Configurar Secrets (Produção)
```bash
supabase secrets set OPENROUTER_API_KEY=xxx
supabase secrets set ELEVENLABS_API_KEY=xxx
supabase secrets set ASAAS_API_KEY=xxx
```

## Variáveis de Ambiente

### Frontend (.env)
| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon Key |

### Edge Functions (Secrets)
| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | Auto-injetado |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injetado |
| `OPENROUTER_API_KEY` | LLM Provider |
| `ELEVENLABS_API_KEY` | TTS (atual) |
| `VOICEKILLER_API_KEY` | TTS (futuro) |
| `ASAAS_API_KEY` | Pagamentos |
| `ASAAS_WEBHOOK_TOKEN` | Validação webhook |

## Migrations

### Criar nova migration
```bash
supabase migration new nome_da_migration
```

### Aplicar migrations
```bash
supabase db push
```

### Reset local (CUIDADO)
```bash
supabase db reset
```

## Checklist de Deploy

- [ ] Atualizar versão em `package.json`
- [ ] Atualizar `public/version.json`
- [ ] Adicionar entrada no `docs/CHANGELOG.md`
- [ ] Rodar `npm run build` sem erros
- [ ] Deploy Edge Functions alteradas
- [ ] Aplicar migrations se houver
- [ ] Testar em staging antes de produção

## Monitoramento

- **Supabase Dashboard**: Logs, métricas, uso
- **Edge Function Logs**: `supabase functions logs <nome>`
- **Sentry** (opcional): Error tracking
