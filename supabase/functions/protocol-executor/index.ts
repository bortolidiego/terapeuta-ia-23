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
  console.log(`Generating assembly instructions for event: "${selectedEvent}", sentiments: ${selectedSentiments.length}`);
  
  // Extrair essência do evento
  const eventEssence = extractEventEssence(selectedEvent);
  console.log(`Event essence extracted: "${eventEssence}"`);

  // Buscar fragmentos base disponíveis
  const { data: baseFragments, error: fragmentsError } = await supabase
    .from('audio_components')
    .select('*')
    .eq('is_available', true)
    .eq('protocol_type', 'evento_traumatico_especifico')
    .eq('component_type', 'base_word');

  if (fragmentsError) {
    console.error('Erro ao buscar fragmentos:', fragmentsError);
    throw new Error('Falha ao carregar fragmentos de áudio');
  }

  console.log(`Found ${baseFragments.length} available base fragments`);

  // OTIMIZAÇÃO: Limitar número de sentimentos processados para reduzir tempo
  const maxSentiments = 15; // Reduzir de 50+ para 15
  const optimizedSentiments = selectedSentiments.slice(0, maxSentiments);
  
  console.log(`Optimized sentiments from ${selectedSentiments.length} to ${optimizedSentiments.length}`);

  // Criar sequência de montagem otimizada
  const assemblySequence = [];

  // OTIMIZAÇÃO: Sequência compacta - uma única passagem por sentimento
  optimizedSentiments.forEach((sentiment, index) => {
    // Alternar entre sequências para variedade
    if (index % 3 === 0) {
      // Sequência tipo 1: Limpeza + Recebimento
      assemblySequence.push(
        { type: 'sentiment', sentiment: sentiment },
        { type: 'base_word', componentKey: 'base_que_senti' },
        { type: 'base_word', componentKey: 'base_acabaram' },
        { type: 'base_word', componentKey: 'base_recebo_agora' },
        { type: 'event', text: 'paz e harmonia' },
        { type: 'base_word', componentKey: 'base_em_mim' }
      );
    } else if (index % 3 === 1) {
      // Sequência tipo 2: Libertação direta
      assemblySequence.push(
        { type: 'base_word', componentKey: 'base_liberto_agora' },
        { type: 'sentiment', sentiment: sentiment },
        { type: 'base_word', componentKey: 'base_de_mim' },
        { type: 'base_word', componentKey: 'base_para_sempre' }
      );
    } else {
      // Sequência tipo 3: Transformação
      assemblySequence.push(
        { type: 'sentiment', sentiment: sentiment },
        { type: 'event', text: 'se transforma em amor' },
        { type: 'base_word', componentKey: 'base_em_mim' },
        { type: 'base_word', componentKey: 'base_completamente' }
      );
    }
  });

  // Sequência final para o evento específico (compacta)
  assemblySequence.push(
    { type: 'base_word', componentKey: 'base_liberto_agora' },
    { type: 'event', text: eventEssence },
    { type: 'base_word', componentKey: 'base_de_mim' },
    { type: 'base_word', componentKey: 'base_completamente' },
    { type: 'event', text: 'paz, amor e harmonia' },
    { type: 'base_word', componentKey: 'base_recebo_agora' },
    { type: 'base_word', componentKey: 'base_para_sempre' }
  );

  console.log(`Total assembly sequence: ${assemblySequence.length} segments (optimized)`);

  // Definir instruções de montagem otimizadas
  const assemblyInstructions = {
    protocolType: 'evento_traumatico_especifico',
    selectedEvent: eventEssence,
    selectedSentiments: optimizedSentiments,
    originalSentimentCount: selectedSentiments.length,
    sequence: assemblySequence,
    estimatedDuration: assemblySequence.length * 2.5, // Reduzido para 2.5s por fragmento
    totalFragments: assemblySequence.length,
    optimizations: {
      sentimentReduction: `${selectedSentiments.length} → ${optimizedSentiments.length}`,
      sequenceType: 'compact',
      estimatedTime: `${Math.ceil(assemblySequence.length * 2.5 / 60)} minutos`
    },
    metadata: {
      sentimentSequences: optimizedSentiments.length,
      eventSequences: 1,
      totalBaseWords: assemblySequence.filter(s => s.type === 'base_word').length,
      totalSentiments: assemblySequence.filter(s => s.type === 'sentiment').length,
      totalEvents: assemblySequence.filter(s => s.type === 'event').length
    }
  };

  // Verificar se todos os fragmentos base estão disponíveis
  const requiredBaseWords = ['base_que_senti', 'base_acabaram', 'base_recebo_agora', 'base_em_mim', 'base_para_sempre', 'base_liberto_agora', 'base_de_mim', 'base_completamente'];
  const availableBaseWords = baseFragments.map(frag => frag.component_key);
  const unavailableComponents = requiredBaseWords.filter(comp => !availableBaseWords.includes(comp));

  const isReady = unavailableComponents.length === 0;

  return {
    type: 'assembly_instructions',
    assemblyInstructions,
    unavailableComponents,
    ready: isReady,
    sentimentCount: optimizedSentiments.length,
    originalSentimentCount: selectedSentiments.length,
    optimized: true,
    message: isReady 
      ? `Protocolo otimizado: ${assemblySequence.length} fragmentos (~${Math.ceil(assemblySequence.length * 2.5 / 60)} min)`
      : `Fragmentos não disponíveis: ${unavailableComponents.join(', ')}`
  };
}

function extractEventEssence(event: string): string {
  // Remover apenas aspas no início e fim, mantendo o contexto temporal
  let essence = event.replace(/^["']|["']$/g, '');
  
  // Remover apenas pontuação final, mas manter prefixos temporais
  essence = essence.replace(/[,.]?\s*$/, '').trim();
  
  return essence;
}