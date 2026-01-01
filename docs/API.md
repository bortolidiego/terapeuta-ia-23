# 📡 API - Edge Functions

## Visão Geral

Todas as Edge Functions estão em `supabase/functions/` e rodam no Deno Runtime.

## Funções Disponíveis

### 🧠 Terapia

#### `therapy-chat`
Processa mensagens do chat terapêutico.

```typescript
POST /functions/v1/therapy-chat

Body:
{
  "message": string,
  "sessionId": string,
  "history": Message[]
}

Response:
{
  "content": string,
  "detectedSentiments": string[]
}
```

#### `protocol-executor`
Gera comandos quânticos para protocolos.

```typescript
POST /functions/v1/protocol-executor

Body:
{
  "protocol": "evento_traumatico_especifico",
  "eventDescription": string,
  "sentiments": string[]
}

Response:
{
  "commands": Command[],
  "assemblyInstructions": AssemblyInstructions
}
```

#### `generate-sentiments`
Gera 60 sentimentos negativos baseados em contexto.

```typescript
POST /functions/v1/generate-sentiments

Body:
{
  "context": string
}

Response:
{
  "sentiments": string[]
}
```

---

### 🎤 Áudio

#### `audio-assembly`
Monta áudio completo do protocolo em background.

```typescript
POST /functions/v1/audio-assembly

Body:
{
  "assemblyInstructions": AssemblyInstructions,
  "sessionId": string,
  "userId": string
}

Response:
{
  "success": true,
  "jobId": string,
  "estimatedDuration": number
}
```

#### `voice-cloning`
Inicia processo de clonagem de voz.

#### `voice-clone-test`
Testa voz clonada com amostra.

#### `voice-clone-confirm`
Confirma e salva voz clonada.

---

### 💳 Pagamentos

#### `asaas-create-charge`
Cria cobrança no Asaas (PIX/Cartão/Boleto).

```typescript
POST /functions/v1/asaas-create-charge

Body:
{
  "packageId": "basico" | "premium" | "pro",
  "billingType": "PIX" | "CREDIT_CARD" | "BOLETO"
}

Response:
{
  "success": true,
  "payment": {
    "id": string,
    "status": string,
    "pixQrCodeId": string,
    "pixCopiaECola": string,
    "invoiceUrl": string
  },
  "package": PackageInfo,
  "purchaseId": string
}
```

#### `asaas-webhook`
Recebe notificações do Asaas sobre pagamentos.

```typescript
POST /functions/v1/asaas-webhook

Headers:
  asaas-access-token: string

Body: AsaasWebhookPayload

Response:
{ "success": true }
```

---

## Autenticação

A maioria das funções requer JWT no header:

```
Authorization: Bearer <jwt_token>
```

Funções com `verify_jwt = false` no `config.toml` podem ser chamadas sem token.

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço |
| `OPENROUTER_API_KEY` | API do OpenRouter (LLM) |
| `ELEVENLABS_API_KEY` | API do ElevenLabs (TTS) |
| `ASAAS_API_KEY` | API do Asaas (Pagamentos) |
