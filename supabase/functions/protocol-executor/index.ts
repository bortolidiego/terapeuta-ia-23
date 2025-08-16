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
        response = await generateQuantumCommands(actionData.selectedEvent, actionData.selectedSentiments, supabase);
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

async function generateQuantumCommands(selectedEvent: string, selectedSentiments: string[], supabase: any) {
  console.log(`Generating commands for event: "${selectedEvent}", sentiments: ${selectedSentiments.length}`);
  
  // Extrair essência do evento
  const eventEssence = extractEventEssence(selectedEvent);
  console.log(`Event essence extracted: "${eventEssence}"`);

  // Buscar templates do banco de dados
  const { data: templates, error } = await supabase
    .from('audio_templates')
    .select('template_key, template_text');

  if (error) {
    console.error('Erro ao buscar templates:', error);
    throw new Error('Falha ao carregar templates do banco');
  }

  // Converter array para objeto para facilitar acesso
  const templateMap = templates.reduce((acc: any, template: any) => {
    acc[template.template_key] = template.template_text;
    return acc;
  }, {});

  const commands = [];

  // Comandos específicos para cada sentimento
  selectedSentiments.forEach(sentiment => {
    const template = templateMap['quantum_alma_senti'];
    if (template) {
      commands.push(template.replace('[SENTIMENT]', sentiment).replace('[EVENT]', eventEssence));
    }
  });

  // Comandos gerais ALMA
  if (templateMap['quantum_alma_recebi']) {
    commands.push(templateMap['quantum_alma_recebi'].replace('[EVENT]', eventEssence));
  }
  if (templateMap['quantum_alma_senti_geral']) {
    commands.push(templateMap['quantum_alma_senti_geral'].replace('[EVENT]', eventEssence));
  }

  // Comandos ESPÍRITO
  if (templateMap['quantum_espirito_gerou_completo']) {
    commands.push(templateMap['quantum_espirito_gerou_completo'].replace('[EVENT]', eventEssence));
  }
  if (templateMap['quantum_espirito_recebi_completo']) {
    commands.push(templateMap['quantum_espirito_recebi_completo'].replace('[EVENT]', eventEssence));
  }

  return {
    commands,
    event: selectedEvent,
    eventEssence,
    sentimentCount: selectedSentiments.length
  };
}

function extractEventEssence(event: string): string {
  // Remover apenas aspas no início e fim, mantendo o contexto temporal
  let essence = event.replace(/^["']|["']$/g, '');
  
  // Remover apenas pontuação final, mas manter prefixos temporais
  essence = essence.replace(/[,.]?\s*$/, '').trim();
  
  return essence;
}