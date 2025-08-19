import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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
      throw new Error('Unauthorized');
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

    // Generate personalized inspirational text for voice cloning
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em gerar textos para clonagem de voz que sejam:
            1. Inspiracionais e motivacionais
            2. Com diversidade fonética rica (todas as letras, sons, entonações)
            3. Incluam emoções variadas (alegria, tranquilidade, determinação, esperança)
            4. Duração de aproximadamente 2 minutos quando lidos
            5. Personalizados para terapia de auto-cura
            
            O texto deve ter cerca de 300-400 palavras e incluir:
            - Variações de tom emocional
            - Palavras com todos os fonemas do português
            - Frases com interrogações, exclamações e afirmações
            - Ritmo variado (frases curtas e longas)
            - Conteúdo inspiracional sobre superação e crescimento pessoal`
          },
          {
            role: 'user',
            content: `Gere um texto inspiracional personalizado para ${userName} (${userGender}) de ${userCity}. 
            O texto deve ser perfeito para clonagem de voz, incluindo rica diversidade fonética e emocional.
            Foque em temas de auto-cura, crescimento pessoal, superação de desafios e descoberta do potencial interior.`
          }
        ],
        max_tokens: 600,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: user.id,
      service: 'openai',
      operation_type: 'voice_sample_text',
      tokens_used: data.usage.total_tokens,
      cost_usd: (data.usage.total_tokens * 0.000001), // Approximate cost
      metadata: { model: 'gpt-4o-mini', character_count: generatedText.length }
    });

    return new Response(JSON.stringify({ 
      text: generatedText,
      estimated_duration: Math.ceil(generatedText.length / 2.5), // ~2.5 chars per second
      word_count: generatedText.split(' ').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-voice-sample-text function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});