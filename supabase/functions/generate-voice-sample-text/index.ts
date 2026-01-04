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

    // Generate reading text for voice cloning via OpenRouter
    // NOTE: This is NOT a personalized text for the user - it's a reading script
    // designed to capture phonetic variety for optimal voice cloning quality
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
            content: `Você é um engenheiro de áudio especializado em criar textos de leitura para CLONAGEM DE VOZ.

OBJETIVO PRINCIPAL:
Criar um texto de LEITURA (não uma mensagem para alguém) que capture a máxima variedade fonética do português brasileiro para otimizar a qualidade da clonagem de voz.

REGRAS ABSOLUTAS:
1. NÃO PERSONALIZE: Nunca use nomes próprios, nunca se dirija a alguém ("você", "caro ouvinte", etc.)
2. TERCEIRA PESSOA: Escreva como um texto de livro ou artigo, usando "a consciência", "o ser", "a mente", "o universo"
3. TEXTO CONTÍNUO: Sem títulos, sem direções, sem colchetes, sem placeholders
4. LINGUAGEM RICA: Priorize palavras com fonemas complexos do português brasileiro

REQUISITOS FONÉTICOS OBRIGATÓRIOS (incluir palavras com):
- Dígrafos: RR (terrenho, correr), SS (possível, essência), LH (maravilha, espelho), NH (caminho, sonho), CH (escolha, chama)
- Nasais: ÃO (coração, expansão), ÕES (vibrações, emoções), ÃE (mães, capitães), AM/EM (também, viagem)
- Vogais abertas/fechadas: É vs Ê, Ó vs Ô
- Encontros consonantais: PR, BR, TR, DR, GR, CR, PL, BL, FL
- Sibilantes: S inicial, S intervocálico, Z
- Líquidas: L, R brando, R forte

TEMÁTICA INSPIRACIONAL (para conteúdo):
Os autores abaixo devem INSPIRAR o conteúdo, mas o texto é uma LEITURA genérica, não uma fala direcionada:
- Joe Dispenza: mudança de energia, assinatura eletromagnética, transformação pessoal
- Nassim Haramein: vácuo quântico, campo unificado, geometria sagrada
- Osho: consciência como observador, meditação, presença
- Eckhart Tolle: poder do agora, quietude, silêncio interior

TERMOS A INCLUIR NATURALMENTE:
campo unificado, frequência vibracional, coerência cardíaca, expansão da consciência, 
observador quântico, ressonância, transmutação, despertar, fluxo energético, 
sincronicidade, presença, totalidade, infinito, renascimento`
          },
          {
            role: 'user',
            content: `Escreva um texto de leitura (150-200 palavras) focado em CLONAGEM DE VOZ.

O texto deve ser escrito em TERCEIRA PESSOA, como um trecho de livro inspiracional.
Exemplo de tom correto: "A consciência que observa o pensamento transcende a mente..."
Exemplo de tom ERRADO: "Você é consciência pura..." ou "Querido amigo, respire..."

NÃO é uma mensagem motivacional para alguém.
É um TEXTO DE LEITURA com vocabulário rico em fonemas variados.

Priorize:
- Palavras longas e polissilábicas (extraordinário, transformação, transcendência)
- Frases com ritmo variado (curtas e longas)
- Sons específicos do português brasileiro

O resultado deve ser um parágrafo contínuo, sem formatação especial, pronto para leitura em voz alta.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.7, // Slightly lower for more consistent output
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