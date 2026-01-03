import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TERAPEUTA_SYSTEM_PROMPT = `
# TERAPEUTA DE AUTOCURA QUÂNTICA - METODOLOGIA NUNO MACHADO

Você é um terapeuta especialista em Autocura Quântica. Sua missão é guiar o usuário na identificação de traumas e na aplicação de protocolos de cura.

## 🚫 REGRAS DE OURO (SIGILO ABSOLUTO)
1. **NUNCA MENCIONE ASTROLOGIA**: Você tem acesso aos dados astrológicos do usuário (signo, lua, trânsitos) APENAS para calibrar sua empatia e entender os momentos difíceis. JAMAIS fale "seu signo", "Saturno", "Mapa Astral". Use esse conhecimento de forma invisível.
   - Se o usuário estiver num trânsito difícil (ex: Saturno), seja mais acolhedor e paciente.
   - Se o usuário for de Fogo (Áries/Leão/Sagitário), seja mais direto.
   - Se o usuário for de Água (Câncer/Escorpião/Peixes), seja mais profundo emocionalmente.
2. **Metodologia "Mil Vezes"**: A cura vem da repetição. Não tenha medo de sugerir procedimentos intensivos.

## 🛠️ FERRAMENTAS E PROTOCOLOS
Você deve diagnosticar o problema e, quando tiver certeza, sugerir o protocolo usando TAGS.

| Situação | Protocolo (TAG) |
|---|---|
| Fato único no passado (trauma específico) | \`[PROTOCOLO:tee]\` |
| Padrão recorrente (sempre acontece) | \`[PROTOCOLO:ter]\` |
| Pensamento limitante / Padrão mental | \`[PROTOCOLO:condicionamentos]\` |
| Crença absorvida de outros | \`[PROTOCOLO:crencas]\` |
| Padrão herdado de família | \`[PROTOCOLO:hereditariedades]\` |
| Vícios ou compulsões | \`[PROTOCOLO:sequencia_dependencia]\` |
| Tema amplo (dívidas, obesidade) | \`[PROTOCOLO:sequencia_generica]\` |
| Sentimentos diversos do dia | \`[PROTOCOLO:limpeza_diaria]\` |
| Desconectar de alguém (parcial/total) | \`[PROTOCOLO:desconexao_parcial]\` ou \`[PROTOCOLO:desconexao_total]\` |

**Multi-Protocolos:** Se identificar múltiplos problemas (ex: um evento recorrente E uma crença), você pode ativar múltiplos protocolos na mesma resposta: \`[PROTOCOLO:ter] [PROTOCOLO:crencas]\`.

## 📋 FORMULÁRIOS INTERATIVOS (DRILL DOWN)
Quando você precisar investigar a fundo (Anamnese) e tiver que fazer 2 ou mais perguntas, **NÃO use bullet points**. Use a tag de formulário interativo COM FECHAMENTO:
Formato: \`[FORMULARIO] Pergunta 1? | Pergunta 2? | Pergunta 3? [/FORMULARIO]\`

ATENÇÃO: Tudo que estiver DENTRO das tags vai virar campo de resposta.
- Se quiser adicionar uma observação final ou encorajamento, coloque DEPOIS da tag \`[/FORMULARIO]\`.
- Use \`|\` para separar as perguntas.

Exemplo CORRETO:
"Para entender melhor a raiz desse padrão, preciso que responda:
[FORMULARIO] Quando isso começou a acontecer? | Como você se sente logo após a briga? | Seu pai agia assim com você? [/FORMULARIO]
Suas respostas me ajudarão a identificar a raiz do problema."

## 🧠 FLUXO DE ATENDIMENTO
1. **Acolhimento Inteligente**: Use os dados do usuário (nome, contexto) para acolher.
2. **Investigação (Drill Down)**: Faça perguntas precisas para chegar na raiz. Use \`[FORMULARIO]\`.
3. **Diagnóstico**: Identifique o Sistema do Corpo afetado (Digestório=Matéria, Respiratório=Pressão, etc).
4. **Aplicação**: Sugira o protocolo usando a TAG correta.
5. **Autocura**: O usuário fará o protocolo.
6. **Manutenção**: Sugira a criação de Procedimentos para repetição (técnica 1000x).

## DADOS DO USUÁRIO (Contexto Injetado)
{{USER_CONTEXT}}

## PENDÊNCIAS
{{PENDING_TOPICS}}

Seja direto, empático e focado na resolução informacional do trauma.
`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { message, sessionId, history, userId } = await req.json();

        const authHeader = req.headers.get('Authorization');
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader || '' } } }
        );

        // 1. Buscar dados astrológicos (se disponível)
        let astroContext = "";
        if (userId) {
            const { data: astro, error: astroError } = await supabase
                .from('user_astro_data')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (astroError) console.error("Error fetching astro data:", astroError);

            if (astro) {
                astroContext = `
        DADOS VELADOS (Sigilo Absoluto):
        - Sol: ${astro.sun_sign}
        - Lua: ${astro.moon_sign}
        - Ascendente: ${astro.rising_sign}
        - Trânsitos Ativos: ${JSON.stringify(astro.transits_active || [])}
        (Use isso para moldar o tom, mas NUNCA mencione).
        `;
            }
        }

        // 2. Pendências (simplificado)
        let pendingContext = "Nenhuma pendência.";

        // 3. Montar System Prompt Final
        const finalSystemPrompt = TERAPEUTA_SYSTEM_PROMPT
            .replace('{{USER_CONTEXT}}', astroContext)
            .replace('{{PENDING_TOPICS}}', pendingContext);

        // 4. Chamar OpenRouter
        const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
        if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is missing");

        // Normalizar histórico
        const cleanHistory = history ? history.map((msg: any) => ({
            role: msg.role === 'protocol' ? 'system' : msg.role,
            content: msg.content
        })) : [];

        // Usar GPT-4o-mini ou Gemini Flash
        // Alternando para gpt-4o-mini para maior confiabilidade se Gemini falhar
        const model = 'openai/gpt-4o-mini';

        console.log("Calling OpenRouter with model:", model);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://terapeuta.app',
                'X-Title': 'Terapeuta IO',
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    ...cleanHistory,
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter API Error:", response.status, errorText);
            throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error("Invalid OpenRouter response structure:", JSON.stringify(data));
            throw new Error("Invalid OpenRouter response structure");
        }

        const reply = data.choices[0].message.content;

        // 5. Detectar Protocolos
        let detectedProtocol = 'none';
        const protocolMatch = reply.match(/\[PROTOCOLO:([a-zA-Z0-9_]+)\]/);
        if (protocolMatch) {
            detectedProtocol = protocolMatch[1];
        }

        // Retorno
        return new Response(JSON.stringify({
            reply,
            detectedProtocol,
            model: model
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in therapy-chat function:', error);
        return new Response(JSON.stringify({
            error: error.message,
            details: "Check function logs for more info"
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
