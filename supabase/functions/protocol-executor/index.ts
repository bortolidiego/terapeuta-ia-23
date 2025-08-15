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
    const { sessionId, userMessage, action, actionData } = await req.json();
    console.log(`Protocol executor - Action: ${action}, Session: ${sessionId}`);

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    let response;

    switch (action) {
      case 'classify_protocol':
        response = await classifyProtocol(supabase, userMessage);
        break;
      case 'normalize_event':
        response = await normalizeEvent(userMessage);
        break;
      case 'generate_commands':
        response = await generateQuantumCommands(actionData.selectedEvent, actionData.selectedSentiments);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in protocol-executor function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function classifyProtocol(supabase: any, userMessage: string) {
  console.log(`Classifying message: "${userMessage}"`);
  
  const { data, error } = await supabase.rpc('classify_protocol', { 
    user_message: userMessage 
  });

  if (error) {
    console.error('Error classifying protocol:', error);
    throw error;
  }

  return { protocol: data };
}

async function normalizeEvent(userMessage: string) {
  console.log(`Normalizing event: "${userMessage}"`);
  
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você normaliza eventos em 3 variações EXATAS seguindo estes padrões:
1. "Quando [evento]"
2. "A primeira vez que [evento]" 
3. "A última vez que [evento]"

Mantenha o evento original, apenas ajuste para cada padrão. Seja preciso e natural.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 150,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const normalizedText = data.choices[0].message.content;
  
  // Extrair as 3 frases do resultado
  const lines = normalizedText.split('\n').filter(line => line.trim()).slice(0, 3);
  
  return { 
    variations: lines.map(line => line.replace(/^\d+\.\s*/, '').trim())
  };
}

async function generateQuantumCommands(selectedEvent: string, selectedSentiments: string[]) {
  console.log(`Generating commands for event: "${selectedEvent}", sentiments: ${selectedSentiments.length}`);
  
  const commands = [];
  
  // Gerar uma linha para cada sentimento
  for (const sentiment of selectedSentiments) {
    commands.push(`${sentiment} que eu senti ${selectedEvent} ACABARAM!`);
  }
  
  // Adicionar as 4 linhas fixas
  commands.push(`Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi ${selectedEvent} ACABARAM!`);
  commands.push(`Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti ${selectedEvent} ACABARAM!`);
  commands.push(`Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei ${selectedEvent} ACABARAM!`);
  commands.push(`Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi ${selectedEvent} ACABARAM!`);
  
  return { 
    commands: commands,
    event: selectedEvent,
    sentimentCount: selectedSentiments.length
  };
}