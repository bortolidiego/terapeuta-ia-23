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
        if (!actionData || !actionData.selectedEvent || !actionData.selectedSentiments) {
          console.error('Missing actionData for generate_commands:', { actionData, fullRequest: JSON.stringify({ sessionId, userMessage, action, actionData }) });
          throw new Error('actionData with selectedEvent and selectedSentiments is required for generate_commands');
        }
        console.log('Generate commands - Event:', actionData.selectedEvent, 'Sentiments count:', actionData.selectedSentiments.length);
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

// FASE 2: Quantum command generation - Protocolo Linear Simples
async function generateQuantumCommands(selectedEvent: string, selectedSentiments: string[], supabase: any) {
  try {
    console.log('[generateQuantumCommands] Starting with:', { selectedEvent, selectedSentiments });
    
    // VALIDAÇÃO CRÍTICA: Mínimo 40 sentimentos obrigatórios
    if (selectedSentiments.length < 40) {
      throw new Error(`Protocolo requer mínimo 40 sentimentos. Recebidos: ${selectedSentiments.length}`);
    }
    
    // Extract the essence of the event
    const eventEssence = extractEventEssence(selectedEvent);
    console.log('[generateQuantumCommands] Event essence:', eventEssence);
    
    // Fetch available base components from audio_components
    const { data: audioComponents, error: audioError } = await supabase
      .from('audio_components')
      .select('component_key, text_content, component_type')
      .eq('component_type', 'base_word')
      .eq('is_available', true);
    
    if (audioError) {
      console.error('[generateQuantumCommands] Error fetching audio components:', audioError);
      throw new Error('Failed to fetch audio components');
    }
    
    console.log('[generateQuantumCommands] Available audio components:', audioComponents);
    
    // SEQUÊNCIA LINEAR EXATA DO PROTOCOLO
    const assemblySequence = [];
    let sequenceId = 1;
    
    // PARTE 1: Frases individuais para cada sentimento
    // "Código ALMA, a minha consciência escolhe: [SENTIMENT] que eu senti [EVENT], ACABARAM!"
    for (const sentiment of selectedSentiments) {
      assemblySequence.push({
        sequenceId: sequenceId++,
        components: [
          'base_code_alma',
          'base_minha_consciencia_escolhe', 
          sentiment,
          'base_que_senti',
          eventEssence,
          'base_acabaram'
        ],
        estimatedDuration: 8
      });
    }
    
    // PARTE 2: 4 Frases finais obrigatórias do protocolo
    
    // 1. "Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi [EVENT], ACABARAM!"
    assemblySequence.push({
      sequenceId: sequenceId++,
      components: [
        'base_code_alma',
        'base_minha_consciencia_escolhe',
        'base_todos_sentimentos_prejudiciais',
        'base_que_recebi',
        eventEssence,
        'base_acabaram'
      ],
      estimatedDuration: 8
    });
    
    // 2. "Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti [EVENT], ACABARAM!"
    assemblySequence.push({
      sequenceId: sequenceId++,
      components: [
        'base_code_alma',
        'base_minha_consciencia_escolhe',
        'base_todos_sentimentos_prejudiciais',
        'base_que_senti',
        eventEssence,
        'base_acabaram'
      ],
      estimatedDuration: 8
    });
    
    // 3. "Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei [EVENT], ACABARAM!"
    assemblySequence.push({
      sequenceId: sequenceId++,
      components: [
        'base_code_espirito',
        'base_informacoes_prejudiciais_gerei',
        eventEssence,
        'base_acabaram'
      ],
      estimatedDuration: 8
    });
    
    // 4. "Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi [EVENT], ACABARAM!"
    assemblySequence.push({
      sequenceId: sequenceId++,
      components: [
        'base_code_espirito',
        'base_informacoes_prejudiciais_recebi',
        eventEssence,
        'base_acabaram'
      ],
      estimatedDuration: 8
    });
    
    // Verificar componentes necessários
    const requiredComponents = [
      'base_code_alma',
      'base_minha_consciencia_escolhe',
      'base_que_senti',
      'base_que_recebi',
      'base_acabaram',
      'base_todos_sentimentos_prejudiciais',
      'base_code_espirito',
      'base_informacoes_prejudiciais_gerei',
      'base_informacoes_prejudiciais_recebi'
    ];
    
    const availableComponentKeys = audioComponents.map(comp => comp.component_key);
    const missingComponents = requiredComponents.filter(comp => !availableComponentKeys.includes(comp));
    
    if (missingComponents.length > 0) {
      console.warn('[generateQuantumCommands] Missing components:', missingComponents);
    }
    
    const assemblyInstructions = {
      assemblySequence,
      metadata: {
        protocolType: 'evento_traumatico_especifico',
        selectedEvent: selectedEvent,
        sentimentCount: selectedSentiments.length,
        totalSequences: assemblySequence.length,
        estimatedTotalDuration: assemblySequence.reduce((total, seq) => total + seq.estimatedDuration, 0),
        availableComponents: availableComponentKeys,
        missingComponents,
        protocolStructure: {
          individualSentiments: selectedSentiments.length,
          finalPhrases: 4,
          totalPhrases: selectedSentiments.length + 4
        }
      },
      readyForAssembly: missingComponents.length === 0
    };
    
    console.log('[generateQuantumCommands] Generated linear protocol assembly instructions:', assemblyInstructions);
    
    return assemblyInstructions;
  } catch (error) {
    console.error('[generateQuantumCommands] Error:', error);
    throw error;
  }
}

function extractEventEssence(event: string): string {
  // Remover apenas aspas no início e fim, mantendo o contexto temporal
  let essence = event.replace(/^["']|["']$/g, '');
  
  // Remover apenas pontuação final, mas manter prefixos temporais
  essence = essence.replace(/[,.]?\s*$/, '').trim();
  
  return essence;
}