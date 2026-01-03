import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

    // Initialize variables
    let usedFallback = false;
    let generatedSentiments: string[] = [];

    // Gerar sentimentos específicos baseados no contexto
    if (context && context.trim()) {
      console.log('Chamando OpenRouter para gerar sentimentos...');

      const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!openRouterApiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://terapeuta.app',
          'X-Title': 'Terapeuta IA',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
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
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Resposta completa da OpenRouter:', JSON.stringify(data, null, 2));

        const generatedText = data.choices[0].message.content.trim();
        console.log('Texto gerado pela IA:', generatedText);

        // Parse mais robusto da resposta
        generatedSentiments = generatedText
          .replace(/^\d+\.\s*/gm, '') // Remove numeração (1. 2. etc)
          .replace(/^[-•*]\s*/gm, '') // Remove bullets (- • *)
          .split(/[,\n;]/) // Divide por vírgula, quebra de linha ou ponto e vírgula
          .map((s: string) => s.trim().replace(/\.$/, '').toLowerCase()) // Remove ponto final
          .filter((s: string) => s.length > 3 && s.length < 50)
          .filter((s: string) => !s.includes(':') && !s.includes('exemplo'))
          .filter((s: string) => !s.match(/^\d+$/)) // Remove números isolados
          .slice(0, 70); // Permitir até 70 para garantir 60 válidos

        console.log('Sentimentos parseados:', generatedSentiments);
      } else {
        console.error('Erro na resposta da OpenRouter:', response.status, await response.text());
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    console.log('Generated sentiments:', generatedSentiments);

    // Inserir sentimentos novos (ignorando duplicatas via banco)
    if (generatedSentiments.length > 0) {
      // Tentar inserir (se falhar por duplicata, tudo bem)
      await supabase
        .from('sentimentos')
        .insert(
          generatedSentiments.map(sentiment => ({
            nome: sentiment,
            categoria: 'gerado_contexto',
            criado_por: 'sistema',
            contexto: context
          }))
        )
        .select()
        .then(({ error }) => {
          if (error) console.log('Insert note (duplicates skipped):', error.message);
        });
    }

    // Retornar todos os sentimentos disponíveis
    let { data: allSentiments, error: fetchError } = await supabase
      .from('sentimentos')
      .select('*')
      .order('frequencia_uso', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    // OTIMIZAÇÃO CRÍTICA: Priorizar visualmente os sentimentos gerados agora
    // Mesmo que já existissem no banco, vamos marcar como 'gerado_contexto' nesta resposta
    // para que o frontend os mostre no topo.
    // MATCH CASE-INSENSITIVE
    if (allSentiments && generatedSentiments.length > 0) {
      let matchCount = 0;
      allSentiments = allSentiments.map(s => {
        if (generatedSentiments.includes(s.nome.toLowerCase())) {
          matchCount++;
          return { ...s, categoria: 'gerado_contexto' }; // Força categoria para ordenação no front
        }
        return s;
      });

      console.log(`Matched ${matchCount} existing sentiments for highlighting`);

      // Adicionar sentimentos que talvez não tenham sido retornados no select (novos inseridos)
      // se o select original não pegou por algum motivo de delay ou ordenação
      for (const genName of generatedSentiments) {
        // Verificar case-insensitive
        if (!allSentiments.find(s => s.nome.toLowerCase() === genName)) {
          allSentiments.unshift({
            id: crypto.randomUUID(), // ID temporário apenas para renderização
            nome: genName,
            categoria: 'gerado_contexto',
            frequencia_uso: 0,
            criado_por: 'sistema'
          });
        }
      }
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