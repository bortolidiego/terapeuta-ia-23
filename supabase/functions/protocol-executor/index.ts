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
          content: `Você é um classificador especializado em protocolos terapêuticos. 

Analise a mensagem do usuário e determine se ela descreve um evento específico que necessita de protocolo.

PROTOCOLOS DISPONÍVEIS:
- evento_traumatico_especifico: Para eventos específicos, traumas, situações particulares que aconteceram ("quando...", "primeira vez que...", "última vez que...", etc.)

MENSAGENS QUE NÃO PRECISAM DE PROTOCOLO:
- Saudações simples (oi, olá, bom dia)
- Perguntas genéricas (como funciona?, o que você faz?)
- Conversas casuais sem evento específico
- Mensagens vagas ou muito curtas sem contexto

RESPOSTA: Retorne apenas uma palavra:
- "evento_traumatico_especifico" se detectar descrição de evento específico
- "none" se for mensagem casual/saudação/pergunta genérica

Seja criterioso - só classifique como protocolo se realmente houver descrição de um evento específico.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const classification = data.choices[0].message.content.trim().toLowerCase();
  
  console.log(`Classification result: "${classification}"`);
  
  // Normalizar resposta
  if (classification.includes('none') || classification.includes('nenhum')) {
    return { protocol: null };
  }
  
  return { protocol: classification };
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
  
  // Extrair essência do evento (remover aspas e normalizar)
  const eventEssence = extractEventEssence(selectedEvent);
  console.log(`Event essence extracted: "${eventEssence}"`);
  
  const commands = [];
  
  // Gerar uma linha para cada sentimento com template correto
  for (const sentiment of selectedSentiments) {
    commands.push(`Código ALMA, a minha consciência escolhe: ${sentiment} que eu senti ${eventEssence}, ACABARAM!`);
  }
  
  // Adicionar as 4 linhas fixas com template correto
  commands.push(`Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi ${eventEssence}, ACABARAM!`);
  commands.push(`Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti ${eventEssence}, ACABARAM!`);
  commands.push(`Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei ${eventEssence}, ACABARAM!`);
  commands.push(`Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi ${eventEssence}, ACABARAM!`);
  
  return { 
    commands: commands,
    event: selectedEvent,
    eventEssence: eventEssence,
    sentimentCount: selectedSentiments.length
  };
}

function extractEventEssence(event: string): string {
  // Remover aspas no início e fim
  let essence = event.replace(/^["']|["']$/g, '');
  
  // Remover prefixos comuns e normalizar
  essence = essence
    .replace(/^(quando|a primeira vez que|a última vez que)\s+/i, '')
    .replace(/[,.]?\s*$/, '') // Remover pontuação final
    .trim();
  
  return essence;
}