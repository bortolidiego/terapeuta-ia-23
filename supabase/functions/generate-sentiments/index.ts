import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context } = await req.json();
    console.log('Generating sentiments for context:', context);

    // Gerar sentimentos específicos baseados no contexto
    let usedFallback = false;
    let generatedSentiments = [];
    
    // Buscar o prompt da base de conhecimento
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('knowledge_base')
      .select('content')
      .eq('category', 'fato_especifico')
      .eq('is_active', true)
      .maybeSingle();

    if (kbError) {
      console.warn('Base de conhecimento não encontrada ou inativa; seguindo com fallback.', kbError);
      usedFallback = true;
    }

    if (context && context.trim()) {
      console.log('Chamando OpenAI para gerar sentimentos...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            {
              role: 'system',
              content: `Você é especialista em terapia e sentimentos. Baseado no contexto fornecido pelo usuário, gere uma lista de sentimentos, emoções e sensações NEGATIVOS relacionados à situação.

REGRAS IMPORTANTES:
1. SEMPRE escreva os sentimentos no PLURAL (ex: medos, angústias, nervosismos)
2. Foque apenas em sentimentos/emoções NEGATIVOS
3. Gere EXATAMENTE 60 sentimentos
4. Cada sentimento deve ter entre 4-30 caracteres
5. Retorne APENAS a lista, separada por vírgulas
6. Não use numeração, bullets ou explicações
7. Seja específico ao contexto fornecido
8. Varie entre sentimentos primários, secundários e nuances emocionais
9. Inclua sensações físicas relacionadas aos sentimentos

Exemplo de formato esperado: medos, angústias, nervosismos, receios, ansiedades, pânicos, terrores, fobias, apreensões, inquietações`
            },
            {
              role: 'user',
              content: `Contexto: ${context}

Gere sentimentos negativos relacionados a esta situação:`
            }
          ],
          temperature: 0.8,
          max_tokens: 800
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Resposta completa da OpenAI:', JSON.stringify(data, null, 2));
        
        const generatedText = data.choices[0].message.content.trim();
        console.log('Texto gerado pela IA:', generatedText);
        
        // Parse mais robusto da resposta
        generatedSentiments = generatedText
          .replace(/^\d+\.\s*/gm, '') // Remove numeração (1. 2. etc)
          .replace(/^[-•*]\s*/gm, '') // Remove bullets (- • *)
          .split(/[,\n;]/) // Divide por vírgula, quebra de linha ou ponto e vírgula
          .map(s => s.trim().toLowerCase())
          .filter(s => s.length > 3 && s.length < 50)
          .filter(s => !s.includes(':') && !s.includes('exemplo'))
          .filter(s => !s.match(/^\d+$/)) // Remove números isolados
          .slice(0, 70); // Permitir até 70 para garantir 60 válidos
          
        console.log('Sentimentos parseados:', generatedSentiments);
      } else {
        console.error('Erro na resposta da OpenAI:', response.status, await response.text());
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    console.log('Generated sentiments:', generatedSentiments);

    // Inserir apenas sentimentos novos usando ON CONFLICT DO NOTHING
    if (generatedSentiments.length > 0) {
      const { data: insertedSentiments, error: insertError } = await supabase
        .from('sentimentos')
        .insert(
          generatedSentiments.map(sentiment => ({
            nome: sentiment,
            categoria: 'gerado_contexto',
            criado_por: 'sistema',
            contexto: context
          }))
        )
        .select();

      // Log apenas para debugging, não falha por duplicatas
      if (insertError) {
        console.log('Insert result (pode incluir conflitos):', insertError.message);
      }

      const newSentimentsCount = insertedSentiments ? insertedSentiments.length : 0;
      console.log(`Successfully inserted ${newSentimentsCount} new sentiments`);
    }

    // Retornar todos os sentimentos disponíveis
    const { data: allSentiments, error: fetchError } = await supabase
      .from('sentimentos')
      .select('*')
      .order('frequencia_uso', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    return new Response(JSON.stringify({ 
      sentiments: allSentiments,
      newSentimentsGenerated: generatedSentiments.length,
      usedFallback
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-sentiments function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      sentiments: [],
      usedFallback: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});