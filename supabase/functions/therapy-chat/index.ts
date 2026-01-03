import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TERAPEUTA_SYSTEM_PROMPT = `
# TERAPEUTA DE AUTOCURA QUÂNTICA - DR. MYHEALING

Você é o Dr. MyHealing, um terapeuta especialista em Autocura Quântica. Sua missão é guiar o usuário na identificação de traumas e na aplicação de protocolos de cura seguindo a Metodologia Nuno Machado.

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

## 🗣️ ESTILO DE COMUNICAÇÃO (Drill Down Natural)
1. **Conversação Fluida**: Evite listas longas de perguntas. Faça uma ou duas perguntas por vez para não sobrecarregar o usuário.
2. **Investigação Empática**: Use o que o usuário responde para aprofundar a investigação (anamnese), mantendo o tom de um diálogo natural.
3. **Foco na Resposta**: Aguarde a resposta do usuário antes de prosseguir para o próximo diagnóstico ou protocolo, garantindo que você tenha informações suficientes.
4. **NÃO use tags de formulário**: O uso de \`[FORMULARIO]\` está proibido. Use texto puro e natural.

## 🧠 FLUXO DE ATENDIMENTO
1. **Acolhimento Inteligente**: Use os dados do usuário (nome, contexto) para acolher de forma calorosa.
2. **Investigação (Drill Down)**: Faça perguntas precisas para chegar na raiz do trauma ou padrão.
3. **Diagnóstico**: Identifique o Sistema do Corpo afetado (Digestório=Matéria, Respiratório=Pressão, etc).
4. **Aplicação**: Sugira o protocolo usando a TAG correta (ex: \`[PROTOCOLO:tee]\`).
5. **Autocura**: O usuário fará o protocolo sugerido.
6. **Manutenção**: Sugira a criação de Procedimentos para repetição (técnica 1000x).

## DADOS DO USUÁRIO (Contexto Injetado)
{{USER_CONTEXT}}

Seja direto, empático e focado na resolução informacional do trauma através de um diálogo humano e acolhedor.
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


        // 3. Montar System Prompt Final
        // 3.1 Buscar dados do perfil (Nome) e contar sessões
        let profileContext = "";
        let userName = "Usuário";

        if (userId) {
            console.log('Fetching profile and session count for userId:', userId);
            // Buscar nome do perfil
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('full_name')
                .eq('user_id', userId)
                .maybeSingle();

            if (profileError) console.error('Error fetching profile:', profileError);

            // Contar sessões anteriores do usuário
            const { count: sessionCount, error: countError } = await supabase
                .from('therapy_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (countError) console.error('Error counting sessions:', countError);

            userName = profile?.full_name || "Usuário";
            const isFirstSession = (sessionCount || 0) <= 1;
            console.log('Profile context built for:', userName, 'Session count:', sessionCount);

            profileContext = `
        DADOS DO PERFIL:
        - Nome Registrado: ${userName}
        - Total de Sessões: ${sessionCount || 1}

        INSTRUÇÃO DE PERSONALIZAÇÃO:
        1. Sempre trate o usuário por "${userName}" (ou pelo primeiro nome se for composto).
        ${isFirstSession ? '2. PRIMEIRA SESSÃO DETECTADA: É fundamental criar vínculo agora. Pergunte gentilmente: "Como você prefere ser chamado?" ou "Posso te chamar de [Nome]?" logo no início.' : ''}
            `;
        }

        const finalSystemPrompt = TERAPEUTA_SYSTEM_PROMPT
            .replace('{{USER_CONTEXT}}', astroContext + profileContext);

        // 3.1 MEMÓRIA DE LONGO PRAZO (NOVO)
        let memoryContext = "";
        try {
            // Buscar últimas 5 memórias
            const { data: memories } = await supabase
                .from('user_memory')
                .select('content, memory_type, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (memories && memories.length > 0) {
                memoryContext = `
## 🧠 MEMÓRIA DE LONGO PRAZO (Contexto de Sessões Anteriores)
Aqui estão os resumos das últimas conversas e insights importantes. USE isso para dar continuidade e não repetir perguntas.
${memories.map(m => `- [${m.memory_type.toUpperCase()}] ${m.content}`).join('\n')}
`;
                // Injetar no prompt final
                // Como não temos um placeholder específico para memória no prompt original, vamos adicionar ao final ou junto com user context
                // Vamos anexar ao final das instruções, antes dos dados do usuário
            }
        } catch (memError) {
            console.error("Error fetching user memory:", memError);
        }

        const promptWithMemory = finalSystemPrompt + memoryContext;

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
                    { role: 'system', content: promptWithMemory },
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
