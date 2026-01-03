import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { action, sessionId, userId, limit } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // ACTION: SUMMARIZE
        if (action === 'summarize') {
            if (!sessionId || !userId) throw new Error('sessionId and userId required');

            // 1. Verificar se já existe um resumo recente para esta sessão
            const { data: existingMemory } = await supabase
                .from('user_memory')
                .select('*')
                .eq('session_id', sessionId)
                .eq('memory_type', 'summary')
                .maybeSingle();

            if (existingMemory) {
                return new Response(JSON.stringify({ message: "Session already summarized", memory: existingMemory }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // 2. Buscar mensagens da sessão
            const { data: messages } = await supabase
                .from('session_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (!messages || messages.length < 4) { // Ignorar sessões muito curtas
                return new Response(JSON.stringify({ message: "Session too short to summarize" }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // 3. Gerar resumo com LLM
            const transcript = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
            const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://terapeuta.app',
                    'X-Title': 'Terapeuta Memory',
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini', // Modelo rápido e barato
                    messages: [
                        { role: 'system', content: 'Você é um assistente que resume sessões de terapia. Crie um resumo conciso (max 3 parágrafos) focando em: 1. Tema principal/Queixa. 2. Insights ou progressos feitos. 3. O que ficou pendente ou recomendações. Responda APENAS com o texto do resumo.' },
                        { role: 'user', content: `Resuma esta sessão:\n\n${transcript}` }
                    ],
                    temperature: 0.3,
                })
            });

            const aiData = await response.json();
            const summary = aiData.choices?.[0]?.message?.content;

            if (summary) {
                // 4. Salvar resumo
                await supabase.from('user_memory').insert({
                    user_id: userId,
                    session_id: sessionId,
                    memory_type: 'summary',
                    content: summary,
                    relevance_score: 5
                });
            }

            return new Response(JSON.stringify({ success: true, summary }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ACTION: RETRIEVE
        if (action === 'retrieve') {
            if (!userId) throw new Error('userId required');

            // Pegar as últimas 5 memórias mais relevantes/recentes
            const { data: memories } = await supabase
                .from('user_memory')
                .select('content, created_at, memory_type')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit || 5);

            return new Response(JSON.stringify({ memories }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
