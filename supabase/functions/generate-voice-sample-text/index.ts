import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile for personalization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, gender, birth_city')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.full_name || profile?.display_name || 'pessoa especial';
    const userGender = profile?.gender || 'neutro';
    const userCity = profile?.birth_city || 'sua cidade';

    // Generate personalized inspirational text for voice cloning via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': 'https://autocura.app', // Required by OpenRouter
        'X-Title': 'Terapueta IA', // Required by OpenRouter
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: `Você é um roteirista especializado em textos para clonagem de voz.
            
            OBJETIVO:
            Criar um texto contínuo, poético e inspiracional para ser lido em voz alta (aprox. 1 minuto).
            
            REGRAS DE FORMATAÇÃO (CRÍTICAS):
            1. TEXTO LIMPO: Não inclua títulos (ex: "Título: ...") nem direções de palco (ex: "(Início: Tom calmo...)"). Gere APENAS o texto a ser lido.
            2. ZERO PLACEHOLDERS: Nunca use colchetes como [Nome da Cidade]. Integre o nome da cidade e da pessoa naturalmente no fluxo do texto.
            3. SEM INTERRUPÇÕES: Não peça para o usuário completar frases. O texto deve estar 100% pronto.
            4. ESTILO VISUAL: Use *itálico* suavemente para palavras que pedem ênfase. Evite excesso de negrito ou símbolos estranhos. Pode usar emojis pontuais (🌸, ✨) para dar leveza, mas sem exageros.
            
            CONTEÚDO E FONÉTICA:
            - Capture a riqueza do português (rr, ss, lh, nh, ão, ões).
            - Alterne o ritmo: comece suave, suba a energia para algo vibrante e motivador, e termine em paz.
            - O tema CENTRAL é: Potencial Humano, Autocura e Renascimento sob a ótica da Física Quântica.
            - **INSPIRAÇÃO TEMÁTICA (Obrigatória):**
              - **Joe Dispenza:** Focar na mudança de energia/assinatura eletromagnética.
              - **Nassim Haramein:** Conexão com o todo/vácuo quântico.
              - **Osho:** Consciência como observador.
              - **Eckhart Tolle:** O poder do Agora, quietude e presença.
              - Use termos como: campo unificado, colapso da função de onda (poeticamente), frequência vibracional, coerência cardíaca.`
          },
          {
            role: 'user',
            content: `Escreva o roteiro de leitura para ${userName} (${userGender}).
            Quero um texto profundo e transformador (aprox. 150 a 200 palavras, para leitura de 1 minuto).
            
            O texto deve guiar a pessoa a sentir que ela é criadora da própria realidade.
            NÃO mencione cidade ou localização física. O foco é UNIVERSAL e INTERNO.
            Comece saudando a pessoa e convidando-a para essa jornada interior.`
          }
        ],
        max_tokens: 1500, // Aumentado para permitir texto mais longo
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: { message: errorText } };
      }
      throw new Error(`OpenRouter API error: ${errorJson.error?.message || errorText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: user.id,
      service: 'openrouter',
      operation_type: 'voice_sample_text',
      tokens_used: data.usage?.total_tokens || 0,
      cost_usd: 0, // Simplified for now
      metadata: { model: 'google/gemini-2.0-flash-001', character_count: generatedText.length }
    });

    return new Response(JSON.stringify({
      text: generatedText,
      estimated_duration: Math.ceil(generatedText.length / 2.5), // ~2.5 chars per second
      word_count: generatedText.split(' ').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CRITICAL ERROR in generate-voice-sample-text:', error);
    if (!openRouterApiKey) console.error('MISSING OPENROUTER_API_KEY variable');

    return new Response(JSON.stringify({
      error: error.message || 'Internal Server Error',
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});