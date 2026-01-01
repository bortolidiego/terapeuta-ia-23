# 🗄️ Banco de Dados

## Visão Geral

PostgreSQL 15 via Supabase com Row Level Security (RLS) habilitado.

## Tabelas Principais

### `profiles`
Dados do usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | FK para auth.users |
| full_name | text | Nome completo |
| avatar_url | text | URL do avatar |
| asaas_customer_id | text | ID do cliente no Asaas |
| created_at | timestamptz | Data de criação |

### `therapy_sessions`
Sessões de terapia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| title | text | Título gerado |
| status | text | active/paused/completed |
| created_at | timestamptz | Início da sessão |

### `session_messages`
Mensagens do chat.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| session_id | uuid | FK therapy_sessions |
| role | text | user/assistant |
| content | text | Conteúdo da mensagem |
| created_at | timestamptz | Timestamp |

### `user_credits`
Saldo de créditos do usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| user_id | uuid | FK profiles |
| openai_credits | integer | Créditos LLM |
| elevenlabs_credits | integer | Créditos Voz |
| total_spent_openai | decimal | Gasto USD LLM |
| total_spent_elevenlabs | decimal | Gasto USD Voz |

### `usage_tracking`
Histórico de consumo.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| service | text | openai/elevenlabs |
| operation_type | text | Tipo de operação |
| tokens_used | integer | Tokens consumidos |
| cost_usd | decimal | Custo em USD |
| created_at | timestamptz | Timestamp |

### `assembly_jobs`
Jobs de montagem de áudio.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| session_id | uuid | FK therapy_sessions |
| status | text | pending/processing/completed/failed |
| progress_percentage | integer | 0-100 |
| result_audio_path | text | Path no Storage |
| error_message | text | Erro se falhou |

### `audio_fragments_cache`
Cache de TTS para economia.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| voice_id | text | ID da voz |
| text_hash | text | SHA-256 do texto |
| text_content | text | Texto original |
| audio_path | text | Path no Storage |

### `sentimentos`
Base de sentimentos disponíveis.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| nome | text | Nome do sentimento |
| categoria | text | Categoria |
| is_custom | boolean | Se é customizado |

### `credit_purchases` (Nova)
Compras de créditos via Asaas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| asaas_payment_id | text | ID do pagamento |
| package_name | text | Nome do pacote |
| llm_credits_added | integer | Créditos LLM |
| voice_credits_added | integer | Créditos Voz |
| amount_brl | decimal | Valor em R$ |
| payment_method | text | pix/credit_card/boleto |
| status | text | pending/confirmed/failed |
| created_at | timestamptz | Data |
| confirmed_at | timestamptz | Confirmação |

## Storage Buckets

| Bucket | Descrição |
|--------|-----------|
| `audio-assembly` | Áudios montados e cache |
| `avatars` | Fotos de perfil |
| `voice-samples` | Amostras para clonagem |

## RLS Policies

Todas as tabelas têm RLS habilitado. Políticas típicas:

```sql
-- Usuário só vê seus próprios dados
CREATE POLICY "Users can view own data"
ON public.therapy_sessions
FOR SELECT
USING (auth.uid() = user_id);
```
