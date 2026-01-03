import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// PROTOCOL EXECUTOR - METODOLOGIA COMPLETA DE AUTOCURA
// Suporta todos os 20 tipos de protocolo
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage, action, actionData } = await req.json();
    console.log(`Protocol executor - Action: ${action}, Session: ${sessionId}`);

    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    let response;

    switch (action) {
      // ===== BASIC ACTIONS =====
      case 'health_check':
        response = { status: 'healthy', timestamp: new Date().toISOString(), sessionId };
        break;

      case 'classify_protocol':
        response = await classifyProtocol(supabase, userMessage);
        break;

      case 'normalize_event':
        response = await normalizeEvent(userMessage);
        break;

      // ===== TRANSFORMAÇÃO EMOCIONAL =====
      case 'generate_tee': // Transformação Emocional Específica (uma vez na vida)
      case 'generate_commands': // Backward compatibility
        response = await generateTEE(actionData, supabase, sessionId, userId);
        break;

      case 'generate_ter': // Transformação Emocional Recorrente (diária)
        response = await generateTER(actionData, supabase, sessionId, userId);
        break;

      case 'generate_privacoes': // Privações (diária)
        response = await generatePrivacoes(actionData, supabase, sessionId, userId);
        break;

      // ===== TRANSFORMAÇÃO MENTAL =====
      case 'generate_condicionamentos':
        response = await generateCondicionamentos(actionData, supabase);
        break;

      case 'generate_crencas':
        response = await generateCrencas(actionData, supabase);
        break;

      case 'generate_hereditariedades':
        response = await generateHereditariedades(actionData, supabase);
        break;

      // ===== SEQUÊNCIAS =====
      case 'generate_generic_sequence': // 24 comandos
        response = await generateGenericSequence(actionData, supabase, sessionId, userId);
        break;

      case 'generate_dependency_sequence': // 4 comandos (prazeres, desejos, apegos, dependências)
        response = await generateDependencySequence(actionData, supabase);
        break;

      // ===== DESCONEXÕES =====
      case 'generate_disconnection_partial':
        response = await generateDisconnectionPartial(actionData, supabase);
        break;

      case 'generate_disconnection_total':
        response = await generateDisconnectionTotal(actionData, supabase);
        break;

      case 'generate_disconnection_fora_materia':
        response = await generateDisconnectionForaMateria(supabase);
        break;

      // ===== LIMPEZAS =====
      case 'generate_cleanup_daily': // Limpeza diária
        response = await generateCleanupDaily(supabase);
        break;

      case 'generate_cleanup_post_connection': // Limpeza após conexão
        response = await generateCleanupPostConnection(actionData, supabase);
        break;

      // ===== PROGRAMAÇÕES =====
      case 'generate_programming_emotional':
        response = await generateProgrammingEmotional(actionData, supabase);
        break;

      case 'generate_programming_mental':
        response = await generateProgrammingMental(actionData, supabase);
        break;

      case 'generate_programming_material':
        response = await generateProgrammingMaterial(actionData, supabase);
        break;

      // ===== ESPECIAIS =====
      case 'generate_unconscious_period': // Período Inconsciente (uma vez na vida)
        response = await generateUnconsciousPeriod(actionData, supabase, sessionId, userId);
        break;

      case 'generate_detox': // Desintoxicação Quântica
        response = await generateDetox(actionData, supabase);
        break;

      case 'generate_before_ingesting': // Antes de ingerir substâncias
        response = await generateBeforeIngesting(actionData, supabase);
        break;

      case 'generate_substance': // Gerar substâncias no corpo
        response = await generateSubstance(actionData, supabase);
        break;

      // ===== PROCEDIMENTOS =====
      case 'create_procedure':
        response = await createProcedure(actionData, supabase, userId);
        break;

      case 'activate_procedure':
        response = await activateProcedure(actionData, supabase, userId);
        break;

      case 'activate_procedure_1000x':
        response = await activateProcedure1000x(actionData, supabase, userId);
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

// =====================================================
// CLASSIFICAÇÃO DE PROTOCOLO
// =====================================================
async function classifyProtocol(supabase: any, userMessage: string) {
  console.log(`Classifying message: "${userMessage}"`);

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
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um classificador especializado na metodologia de autocura quântica.

PROTOCOLOS DISPONÍVEIS:
1. tee - Transformação Emocional Específica: eventos únicos ("quando...", "primeira vez que...", "última vez que...")
2. ter - Transformação Emocional Recorrente: eventos repetitivos ("todas as vezes que...", "sempre que...")
3. condicionamentos - Padrões de pensar/sentir/reagir ("eu sempre penso...", "tenho o hábito de...")
4. crencas - Ideias dos outros que incomodam ("minha mãe diz que...", "as pessoas falam que...")
5. hereditariedades - Padrões herdados ("meu pai era assim...", "na minha família todos...")
6. sequencia_generica - Temas amplos (dívidas, obesidade, problemas financeiros)
7. sequencia_dependencia - Compulsões/vícios ("sou viciado em...", "não consigo parar de...")
8. desconexao_parcial - Cortar emaranhamentos negativos com pessoa ("preciso me desconectar de...")
9. desconexao_total - Cortar totalmente com pessoa
10. privacoes - O que se priva por causa dos problemas ("não consigo fazer X por causa de...")
11. programacao_emocional - Estados emocionais desejados ("quero sentir mais...")
12. programacao_mental - Novos padrões mentais ("quero pensar diferente sobre...")
13. programacao_material - Situações de vida desejadas ("quero ter...", "quero conquistar...")
14. limpeza_diaria - Limpeza antes de dormir
15. desintoxicacao - Eliminar toxinas do corpo
16. none - Mensagem casual, saudação, pergunta genérica

RESPOSTA: Retorne apenas a chave do protocolo (ex: "tee", "ter", "condicionamentos", "none").
Seja preciso na classificação baseado nos padrões de linguagem.`
        },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 50,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const classification = data.choices[0].message.content.trim().toLowerCase();

  console.log(`Classification result: "${classification}"`);

  if (classification.includes('none') || classification.includes('nenhum')) {
    return { protocol: null };
  }

  return { protocol: classification.replace(/[^a-z_]/g, '') };
}

// =====================================================
// NORMALIZAÇÃO DE EVENTO
// =====================================================
async function normalizeEvent(userMessage: string) {
  console.log(`Normalizing event: "${userMessage}"`);

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
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em linguística e terapia.
Sua tarefa é adaptar a frase do evento fornecida pelo usuário para encaixar perfeitamente em 3 moldes temporais, fazendo os ajustes gramaticais necessários (conjugação, pessoa, tempo) para que a frase soe natural, mas MANTENDO O SENTIDO ORIGINAL.

Se a frase descrever uma recorrência (ex: "quase todos os dias brigamos"), converta para a ação singular do evento (ex: "brigamos") para fazer sentido nos moldes temporais.

Moldes Obrigatórios:
1. "Quando [evento ajustado]"
2. "A primeira vez que [evento ajustado]"
3. "A última vez que [evento ajustado]"

Exemplos:
Entrada: "estou sempre sem dinheiro"
Saída:
Quando fiquei sem dinheiro
A primeira vez que fiquei sem dinheiro
A última vez que fiquei sem dinheiro

Entrada: "quase todos os dias brigamos"
Saída:
Quando brigamos
A primeira vez que brigamos
A última vez que brigamos

Retorne APENAS as 3 frases, uma por linha.

IMPORTANTE:
- Mantenha EXATAMENTE as palavras-chave do usuário (se ele disse "cair do cavalo", use "caí do cavalo").
- NÃO interprete, NÃO resuma e NÃO mude o sentido (ex: NÃO mude "cair do cavalo" para "susto da queda").
- Apenas ajuste a conjugação verbal para encaixar na frase.
- Se a frase for curta, mantenha curta.`
        },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 150,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const normalizedText = data.choices[0].message.content;
  const lines = normalizedText.split('\n').filter((line: string) => line.trim()).slice(0, 3);

  return {
    variations: lines.map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
  };
}

// =====================================================
// TRANSFORMAÇÃO EMOCIONAL ESPECÍFICA (TEE)
// Eventos únicos - Uma vez na vida
// =====================================================
async function generateTEE(actionData: any, supabase: any, sessionId?: string, userId?: string) {
  const { selectedEvent, selectedSentiments } = actionData || {};

  if (!selectedEvent || !selectedSentiments) {
    throw new Error('selectedEvent and selectedSentiments are required for TEE');
  }

  // Validação: Mínimo 20 sentimentos
  if (selectedSentiments.length < 20) {
    throw new Error(`Protocolo requer mínimo 20 sentimentos. Recebidos: ${selectedSentiments.length}`);
  }

  const eventEssence = extractEventEssence(selectedEvent);
  const assemblySequence = [];
  let sequenceId = 1;

  // PARTE 1: Frases individuais para cada sentimento com Código ALMA
  for (const sentiment of selectedSentiments) {
    assemblySequence.push({
      sequenceId: sequenceId++,
      code: 'ALMA',
      components: [
        'base_code_alma',
        'base_minha_consciencia_escolhe',
        sentiment,
        'base_que_eu_senti',
        eventEssence,
        'base_acabaram'
      ],
      text: `Código ALMA, a minha consciência escolhe: ${sentiment} que eu senti ${eventEssence}, ACABARAM!`,
      estimatedDuration: 8
    });
  }

  // PARTE 2: 4 Frases finais obrigatórias
  // 1. Todos sentimentos prejudiciais que recebi
  assemblySequence.push({
    sequenceId: sequenceId++,
    code: 'ALMA',
    components: ['base_code_alma', 'base_minha_consciencia_escolhe', 'base_todos_sentimentos_prejudiciais_recebi', eventEssence, 'base_acabaram'],
    text: `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi ${eventEssence}, ACABARAM!`,
    estimatedDuration: 8
  });

  // 2. Todos sentimentos prejudiciais que senti
  assemblySequence.push({
    sequenceId: sequenceId++,
    code: 'ALMA',
    components: ['base_code_alma', 'base_minha_consciencia_escolhe', 'base_todos_sentimentos_prejudiciais_senti', eventEssence, 'base_acabaram'],
    text: `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti ${eventEssence}, ACABARAM!`,
    estimatedDuration: 8
  });

  // 3. Informações prejudiciais que gerei
  assemblySequence.push({
    sequenceId: sequenceId++,
    code: 'ESPIRITO',
    components: ['base_code_espirito', 'base_minha_consciencia_escolhe', 'base_todas_informacoes_prejudiciais_gerei', eventEssence, 'base_acabaram'],
    text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei ${eventEssence}, ACABARAM!`,
    estimatedDuration: 8
  });

  // 4. Informações prejudiciais que recebi
  assemblySequence.push({
    sequenceId: sequenceId++,
    code: 'ESPIRITO',
    components: ['base_code_espirito', 'base_minha_consciencia_escolhe', 'base_todas_informacoes_prejudiciais_recebi', eventEssence, 'base_acabaram'],
    text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi ${eventEssence}, ACABARAM!`,
    estimatedDuration: 8
  });

  // Salvar protocolo no banco
  if (userId) {
    await saveUserProtocol(supabase, userId, sessionId, 'tee', {
      name: `TEE - ${eventEssence.substring(0, 50)}`,
      event_description: selectedEvent,
      sentiments: selectedSentiments,
      commands: assemblySequence,
      command_count: assemblySequence.length,
      frequency: 'once'
    });
  }

  return {
    protocolType: 'tee',
    assemblySequence,
    metadata: {
      selectedEvent,
      sentimentCount: selectedSentiments.length,
      totalCommands: assemblySequence.length,
      frequency: 'once',
      estimatedTotalDuration: assemblySequence.reduce((total, seq) => total + seq.estimatedDuration, 0)
    },
    readyForAssembly: true
  };
}

// =====================================================
// TRANSFORMAÇÃO EMOCIONAL RECORRENTE (TER)
// Eventos repetitivos - Ativação diária
// =====================================================
async function generateTER(actionData: any, supabase: any, sessionId?: string, userId?: string) {
  const { selectedEvent, selectedSentiments } = actionData || {};

  if (!selectedEvent || !selectedSentiments) {
    throw new Error('selectedEvent and selectedSentiments are required for TER');
  }

  if (selectedSentiments.length < 20) {
    throw new Error(`Protocolo requer mínimo 20 sentimentos. Recebidos: ${selectedSentiments.length}`);
  }

  // Para TER, o evento deve começar com "todas as vezes que"
  const eventEssence = selectedEvent.toLowerCase().startsWith('todas as vezes')
    ? extractEventEssence(selectedEvent)
    : `todas as vezes que ${extractEventEssence(selectedEvent)}`;

  const assemblySequence = [];
  let sequenceId = 1;

  // Estrutura similar ao TEE mas com "todas as vezes que"
  for (const sentiment of selectedSentiments) {
    assemblySequence.push({
      sequenceId: sequenceId++,
      code: 'ALMA',
      text: `Código ALMA, a minha consciência escolhe: ${sentiment} que eu senti ${eventEssence}, ACABARAM!`,
      estimatedDuration: 8
    });
  }

  // 4 frases finais
  assemblySequence.push({
    sequenceId: sequenceId++, code: 'ALMA',
    text: `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu recebi ${eventEssence}, ACABARAM!`
  });
  assemblySequence.push({
    sequenceId: sequenceId++, code: 'ALMA',
    text: `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti ${eventEssence}, ACABARAM!`
  });
  assemblySequence.push({
    sequenceId: sequenceId++, code: 'ESPIRITO',
    text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei ${eventEssence}, ACABARAM!`
  });
  assemblySequence.push({
    sequenceId: sequenceId++, code: 'ESPIRITO',
    text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi ${eventEssence}, ACABARAM!`
  });

  if (userId) {
    await saveUserProtocol(supabase, userId, sessionId, 'ter', {
      name: `TER - ${eventEssence.substring(0, 50)}`,
      event_description: selectedEvent,
      sentiments: selectedSentiments,
      commands: assemblySequence,
      command_count: assemblySequence.length,
      frequency: 'daily'
    });
  }

  return {
    protocolType: 'ter',
    assemblySequence,
    metadata: { selectedEvent, sentimentCount: selectedSentiments.length, totalCommands: assemblySequence.length, frequency: 'daily' },
    readyForAssembly: true
  };
}

// =====================================================
// PRIVAÇÕES
// =====================================================
async function generatePrivacoes(actionData: any, supabase: any, sessionId?: string, userId?: string) {
  const { privacao, selectedSentiments } = actionData || {};

  if (!privacao || !selectedSentiments) {
    throw new Error('privacao and selectedSentiments are required');
  }

  const assemblySequence = [];
  let sequenceId = 1;

  for (const sentiment of selectedSentiments) {
    assemblySequence.push({
      sequenceId: sequenceId++,
      code: 'ALMA',
      text: `Código ALMA, a minha consciência escolhe: ${sentiment} que eu senti por ${privacao}, ACABARAM!`,
      estimatedDuration: 8
    });
  }

  // Frases finais
  assemblySequence.push({
    sequenceId: sequenceId++, code: 'ALMA',
    text: `Código ALMA, a minha consciência escolhe: TODOS OS SENTIMENTOS PREJUDICIAIS que eu senti por ${privacao}, ACABARAM!`
  });
  assemblySequence.push({
    sequenceId: sequenceId++, code: 'ESPIRITO',
    text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei por ${privacao}, ACABARAM!`
  });

  if (userId) {
    await saveUserProtocol(supabase, userId, sessionId, 'privacoes', {
      name: `Privação - ${privacao.substring(0, 50)}`,
      theme: privacao,
      sentiments: selectedSentiments,
      commands: assemblySequence,
      command_count: assemblySequence.length,
      frequency: 'daily'
    });
  }

  return { protocolType: 'privacoes', assemblySequence, metadata: { privacao, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// CONDICIONAMENTOS
// =====================================================
async function generateCondicionamentos(actionData: any, supabase: any) {
  const { padrao } = actionData || {};
  if (!padrao) throw new Error('padrao is required for condicionamentos');

  const assemblySequence = [
    { sequenceId: 1, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: condicionamentos de ${padrao} ACABARAM!` }
  ];

  return { protocolType: 'condicionamentos', assemblySequence, metadata: { padrao, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// CRENÇAS
// =====================================================
async function generateCrencas(actionData: any, supabase: any) {
  const { crenca, pessoa } = actionData || {};
  if (!crenca) throw new Error('crenca is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: crenças de que ${crenca} ACABARAM!` }
  ];

  return { protocolType: 'crencas', assemblySequence, metadata: { crenca, pessoa, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// HEREDITARIEDADES
// =====================================================
async function generateHereditariedades(actionData: any, supabase: any) {
  const { padrao } = actionData || {};
  if (!padrao) throw new Error('padrao is required for hereditariedades');

  const assemblySequence = [
    { sequenceId: 1, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: hereditariedades recebidas de ${padrao} ACABARAM!` }
  ];

  return { protocolType: 'hereditariedades', assemblySequence, metadata: { padrao, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// SEQUÊNCIA GENÉRICA (24 comandos)
// =====================================================
async function generateGenericSequence(actionData: any, supabase: any, sessionId?: string, userId?: string) {
  const { tema } = actionData || {};
  if (!tema) throw new Error('tema is required for sequencia_generica');

  const assemblySequence = [];
  let sequenceId = 1;

  // 24 comandos conforme a metodologia
  const templates = [
    // ALMA - Sentimentos
    { code: 'ALMA', text: `todos os sentimentos que eu senti e que causaram ${tema}` },
    { code: 'ALMA', text: `todos os sentimentos que eu recebi e que causaram ${tema}` },
    // ESPÍRITO - Padrões mentais
    { code: 'ESPIRITO', text: `pensamentos que causaram ${tema}` },
    { code: 'ESPIRITO', text: `condicionamentos que causaram ${tema}` },
    { code: 'ESPIRITO', text: `condicionamentos de manifestar ${tema}` },
    { code: 'ESPIRITO', text: `crenças que causaram ${tema}` },
    { code: 'ESPIRITO', text: `hereditariedades recebidas de ${tema}` },
    // Informações que geraram (ALMA, ESPÍRITO, CORPO)
    { code: 'ALMA', text: `todas as informações que geraram ${tema}` },
    { code: 'ESPIRITO', text: `todas as informações que geraram ${tema}` },
    { code: 'CORPO', text: `todas as informações que geraram ${tema}` },
    // Informações geradas por (ALMA, ESPÍRITO, CORPO)
    { code: 'ALMA', text: `todas as informações geradas por ${tema}` },
    { code: 'ESPIRITO', text: `todas as informações geradas por ${tema}` },
    { code: 'CORPO', text: `todas as informações geradas por ${tema}` },
    // Informações dos fatos
    { code: 'ALMA', text: `todas as informações dos fatos nos quais vivenciei ${tema}` },
    { code: 'ESPIRITO', text: `todas as informações dos fatos nos quais vivenciei ${tema}` },
    { code: 'CORPO', text: `todas as informações dos fatos nos quais vivenciei ${tema}` },
    // Condicionamentos de observar
    { code: 'ESPIRITO', text: `condicionamentos de me observar com ${tema}` },
    // Escolha consciente
    { code: 'ALMA', text: `eu escolho conscientemente vivenciar uma realidade livre de ${tema}` },
    { code: 'ESPIRITO', text: `eu escolho conscientemente vivenciar uma realidade livre de ${tema}` },
    { code: 'CORPO', text: `eu escolho conscientemente vivenciar uma realidade livre de ${tema}` },
    // Não localidade
    { code: 'ESPIRITO', text: `eu resolvo o problema de ${tema} na não localidade` },
    // Declaração final
    { code: 'ALMA', text: `${tema}` },
    { code: 'ESPIRITO', text: `${tema}` },
    { code: 'CORPO', text: `${tema}` },
  ];

  for (const template of templates) {
    const isDeclaracao = template.text === tema;
    assemblySequence.push({
      sequenceId: sequenceId++,
      code: template.code,
      text: isDeclaracao
        ? `Código ${template.code}, a minha consciência escolhe: ${tema} ACABARAM!`
        : `Código ${template.code}, a minha consciência escolhe: ${template.text} ACABARAM!`,
      estimatedDuration: 8
    });
  }

  if (userId) {
    await saveUserProtocol(supabase, userId, sessionId, 'sequencia_generica', {
      name: `Sequência - ${tema}`,
      theme: tema,
      commands: assemblySequence,
      command_count: 24,
      frequency: 'daily'
    });
  }

  return { protocolType: 'sequencia_generica', assemblySequence, metadata: { tema, totalCommands: 24, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// SEQUÊNCIA DA DEPENDÊNCIA (4 comandos)
// =====================================================
async function generateDependencySequence(actionData: any, supabase: any) {
  const { compulsao } = actionData || {};
  if (!compulsao) throw new Error('compulsao is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: prazeres que senti por ${compulsao} ACABARAM!` },
    { sequenceId: 2, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: desejos que senti por ${compulsao} ACABARAM!` },
    { sequenceId: 3, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: apegos que senti por ${compulsao} ACABARAM!` },
    { sequenceId: 4, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: dependências que senti por ${compulsao} ACABARAM!` },
  ];

  return { protocolType: 'sequencia_dependencia', assemblySequence, metadata: { compulsao, totalCommands: 4, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// DESCONEXÕES
// =====================================================
async function generateDisconnectionPartial(actionData: any, supabase: any) {
  const { pessoa } = actionData || {};
  if (!pessoa) throw new Error('pessoa is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: emaranhamentos NEGATIVOS com a consciência de ${pessoa} ACABARAM!` },
    { sequenceId: 2, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: emaranhamentos NEGATIVOS com a consciência de ${pessoa} ACABARAM!` },
    { sequenceId: 3, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: emaranhamentos NEGATIVOS com a consciência de ${pessoa} ACABARAM!` },
  ];

  return { protocolType: 'desconexao_parcial', assemblySequence, metadata: { pessoa, frequency: 'daily' }, readyForAssembly: true };
}

async function generateDisconnectionTotal(actionData: any, supabase: any) {
  const { pessoa } = actionData || {};
  if (!pessoa) throw new Error('pessoa is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: emaranhamentos com a consciência de ${pessoa} ACABARAM!` },
    { sequenceId: 2, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: emaranhamentos com a consciência de ${pessoa} ACABARAM!` },
    { sequenceId: 3, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: emaranhamentos com a consciência de ${pessoa} ACABARAM!` },
  ];

  return { protocolType: 'desconexao_total', assemblySequence, metadata: { pessoa, frequency: 'once' }, readyForAssembly: true };
}

async function generateDisconnectionForaMateria(supabase: any) {
  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: 'Código ALMA, a minha consciência escolhe: emaranhamentos com as consciências negativas que estão ao meu redor ACABARAM!' },
    { sequenceId: 2, code: 'ESPIRITO', text: 'Código ESPÍRITO, a minha consciência escolhe: emaranhamentos com as consciências negativas que estão ao meu redor ACABARAM!' },
    { sequenceId: 3, code: 'CORPO', text: 'Código CORPO, a minha consciência escolhe: emaranhamentos com as consciências negativas que estão ao meu redor ACABARAM!' },
    { sequenceId: 4, code: 'ALMA', text: 'Código ALMA, a minha consciência escolhe: eu emaranho com as consciências positivas!' },
    { sequenceId: 5, code: 'ESPIRITO', text: 'Código ESPÍRITO, a minha consciência escolhe: eu emaranho com as consciências positivas!' },
    { sequenceId: 6, code: 'CORPO', text: 'Código CORPO, a minha consciência escolhe: eu emaranho com as consciências positivas!' },
    { sequenceId: 7, code: 'ALMA', text: 'Código ALMA, a minha consciência escolhe: eu sou fonte de amor e luz para todas as consciências que estiveram ao meu redor!' },
  ];

  return { protocolType: 'desconexao_fora_materia', assemblySequence, metadata: { frequency: 'eventual' }, readyForAssembly: true };
}

// =====================================================
// LIMPEZAS
// =====================================================
async function generateCleanupDaily(supabase: any) {
  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: 'Código ALMA, a minha consciência escolhe: todos os sentimentos prejudiciais que eu senti hoje ACABARAM!' },
    { sequenceId: 2, code: 'ALMA', text: 'Código ALMA, a minha consciência escolhe: todos os sentimentos prejudiciais que eu recebi hoje ACABARAM!' },
    { sequenceId: 3, code: 'ESPIRITO', text: 'Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei hoje ACABARAM!' },
    { sequenceId: 4, code: 'ESPIRITO', text: 'Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi hoje ACABARAM!' },
    { sequenceId: 5, code: 'CORPO', text: 'Código CORPO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei hoje ACABARAM!' },
    { sequenceId: 6, code: 'CORPO', text: 'Código CORPO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi hoje ACABARAM!' },
  ];

  return { protocolType: 'limpeza_diaria', assemblySequence, metadata: { frequency: 'daily' }, readyForAssembly: true };
}

async function generateCleanupPostConnection(actionData: any, supabase: any) {
  const { pessoa, contexto } = actionData || {};
  if (!pessoa) throw new Error('pessoa is required');

  const ctx = contexto ? ` durante ${contexto}` : '';
  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: todos os sentimentos prejudiciais que eu senti durante a conexão com ${pessoa}${ctx} ACABARAM!` },
    { sequenceId: 2, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: todos os sentimentos prejudiciais que eu recebi durante a conexão com ${pessoa}${ctx} ACABARAM!` },
    { sequenceId: 3, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei durante a conexão com ${pessoa}${ctx} ACABARAM!` },
    { sequenceId: 4, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi durante a conexão com ${pessoa}${ctx} ACABARAM!` },
    { sequenceId: 5, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei durante a conexão com ${pessoa}${ctx} ACABARAM!` },
    { sequenceId: 6, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi durante a conexão com ${pessoa}${ctx} ACABARAM!` },
  ];

  return { protocolType: 'limpeza_pos_desconexao', assemblySequence, metadata: { pessoa, contexto, frequency: 'eventual' }, readyForAssembly: true };
}

// =====================================================
// PROGRAMAÇÕES
// =====================================================
async function generateProgrammingEmotional(actionData: any, supabase: any) {
  const { estados } = actionData || {}; // Array de estados emocionais
  if (!estados || estados.length === 0) throw new Error('estados is required');

  const estadosText = Array.isArray(estados) ? estados.join(', ') : estados;
  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: eu sou fonte de ${estadosText}!` }
  ];

  return { protocolType: 'programacao_emocional', assemblySequence, metadata: { estados, frequency: 'daily' }, readyForAssembly: true };
}

async function generateProgrammingMental(actionData: any, supabase: any) {
  const { padrao } = actionData || {};
  if (!padrao) throw new Error('padrao is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: condicionamentos de ${padrao} se fortalecem!` }
  ];

  return { protocolType: 'programacao_mental', assemblySequence, metadata: { padrao, frequency: 'daily' }, readyForAssembly: true };
}

async function generateProgrammingMaterial(actionData: any, supabase: any) {
  const { situacao } = actionData || {};
  if (!situacao) throw new Error('situacao is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: eu já ${situacao}!` },
    { sequenceId: 2, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: eu já ${situacao}!` },
    { sequenceId: 3, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: eu já ${situacao}!` },
  ];

  return { protocolType: 'programacao_material', assemblySequence, metadata: { situacao, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// ESPECIAIS
// =====================================================
async function generateUnconsciousPeriod(actionData: any, supabase: any, sessionId?: string, userId?: string) {
  const { selectedSentiments } = actionData || {};

  if (!selectedSentiments || selectedSentiments.length < 20) {
    throw new Error('Mínimo 20 sentimentos requeridos para Período Inconsciente');
  }

  const assemblySequence = [];
  let sequenceId = 1;

  const periodoText = 'do primeiro dia de minha existência até minha primeira infância';

  // Para cada sentimento
  for (const sentiment of selectedSentiments) {
    assemblySequence.push({
      sequenceId: sequenceId++,
      code: 'ALMA',
      text: `Código ALMA, a minha consciência escolhe: ${sentiment} que eu recebi ${periodoText}, ACABARAM!`
    });
  }

  // Frases finais
  const sentimentosBase = ['raivas', 'medos', 'tristezas', 'vergonhas', 'culpas'];
  for (const sent of sentimentosBase) {
    assemblySequence.push({
      sequenceId: sequenceId++,
      code: 'ALMA',
      text: `Código ALMA, a minha consciência escolhe: ${sent} que eu recebi ${periodoText}, ACABARAM!`
    });
  }

  if (userId) {
    await saveUserProtocol(supabase, userId, sessionId, 'periodo_inconsciente', {
      name: 'Período Inconsciente',
      sentiments: selectedSentiments,
      commands: assemblySequence,
      command_count: assemblySequence.length,
      frequency: 'once'
    });
  }

  return { protocolType: 'periodo_inconsciente', assemblySequence, metadata: { frequency: 'once' }, readyForAssembly: true };
}

async function generateDetox(actionData: any, supabase: any) {
  const { substancia } = actionData || {}; // Ex: metais tóxicos, parasitas, toxinas
  if (!substancia) throw new Error('substancia is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: excesso de ${substancia} presentes no meu corpo ACABARAM!` },
    { sequenceId: 2, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: excesso de ${substancia} presentes no meu corpo ACABARAM!` },
    { sequenceId: 3, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: excesso de ${substancia} presentes no meu corpo ACABARAM!` },
  ];

  return { protocolType: 'desintoxicacao_quantica', assemblySequence, metadata: { substancia, frequency: 'daily' }, readyForAssembly: true };
}

async function generateBeforeIngesting(actionData: any, supabase: any) {
  const { substancia } = actionData || {}; // Ex: remédio, alimento
  if (!substancia) throw new Error('substancia is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: todas as informações prejudiciais deste ${substancia} ACABARAM!` },
    { sequenceId: 2, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais deste ${substancia} ACABARAM!` },
    { sequenceId: 3, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: todas as informações prejudiciais deste ${substancia} ACABARAM!` },
    { sequenceId: 4, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: este ${substancia} é saudável para o meu corpo!` },
    { sequenceId: 5, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: este ${substancia} é saudável para o meu corpo!` },
    { sequenceId: 6, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: este ${substancia} é saudável para o meu corpo!` },
  ];

  return { protocolType: 'antes_ingerir_substancias', assemblySequence, metadata: { substancia, frequency: 'eventual' }, readyForAssembly: true };
}

async function generateSubstance(actionData: any, supabase: any) {
  const { substancia } = actionData || {}; // Ex: serotonina, dopamina
  if (!substancia) throw new Error('substancia is required');

  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `Código ALMA, a minha consciência escolhe: eu absorvo imediatamente as informações positivas de ${substancia} na quantidade ideal para o meu corpo!` },
    { sequenceId: 2, code: 'ESPIRITO', text: `Código ESPÍRITO, a minha consciência escolhe: eu absorvo imediatamente as informações positivas de ${substancia} na quantidade ideal para o meu corpo!` },
    { sequenceId: 3, code: 'CORPO', text: `Código CORPO, a minha consciência escolhe: eu absorvo imediatamente as informações positivas de ${substancia} na quantidade ideal para o meu corpo!` },
  ];

  return { protocolType: 'gerar_substancias', assemblySequence, metadata: { substancia, frequency: 'daily' }, readyForAssembly: true };
}

// =====================================================
// PROCEDIMENTOS
// =====================================================
async function createProcedure(actionData: any, supabase: any, userId?: string) {
  if (!userId) throw new Error('User authentication required');
  const { name, description, protocol_ids, frequency, eventual_trigger } = actionData || {};

  if (!name || !protocol_ids || protocol_ids.length === 0) {
    throw new Error('name and protocol_ids are required');
  }

  const { data, error } = await supabase.from('user_procedures').insert({
    user_id: userId,
    name,
    description,
    protocol_ids,
    frequency: frequency || 'daily',
    eventual_trigger
  }).select().single();

  if (error) throw error;
  return { success: true, procedure: data };
}

async function activateProcedure(actionData: any, supabase: any, userId?: string) {
  if (!userId) throw new Error('User authentication required');
  const { procedure_id } = actionData || {};
  if (!procedure_id) throw new Error('procedure_id is required');

  // Incrementar contador de ativação
  const { data, error } = await supabase.from('user_procedures')
    .update({
      activation_count: supabase.sql`activation_count + 1`,
      last_activated_at: new Date().toISOString()
    })
    .eq('id', procedure_id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;

  // Gerar assemblySequence para o procedimento completo
  const assemblySequence = [
    { sequenceId: 1, code: 'ALMA', text: `eu inicio o procedimento ${data.name}` },
    // Aqui carregaria os protocolos do procedimento e concatenaria
    { sequenceId: 2, code: 'ALMA', text: `eu encerro o procedimento ${data.name}` },
    { sequenceId: 3, code: 'ALMA', text: `eu ativo o procedimento ${data.name}` },
  ];

  return { success: true, procedure: data, assemblySequence };
}

async function activateProcedure1000x(actionData: any, supabase: any, userId?: string) {
  if (!userId) throw new Error('User authentication required');
  const { procedure_id } = actionData || {};
  if (!procedure_id) throw new Error('procedure_id is required');

  // 1. Buscar o procedimento original
  const { data: originalProc, error: fetchError } = await supabase
    .from('user_procedures')
    .select('*')
    .eq('id', procedure_id)
    .single();

  if (fetchError || !originalProc) throw new Error('Procedure not found');

  const baseName = originalProc.name;
  const assemblySequence = [];

  // 2. Helper para gerar comandos do procedimento
  const createActivationCommand = (name: string) =>
    `Código ESPÍRITO, a minha consciência escolhe: eu ATIVO o procedimento ${name}!`;

  const createInitCommand = (name: string) =>
    `Código ESPÍRITO, a minha consciência escolhe: eu INICIO o procedimento ${name}!`;

  const createEndCommand = (name: string) =>
    `Código ESPÍRITO, a minha consciência escolhe: eu ENCERRO o procedimento ${name}!`;

  // === PASSO 1: CRIAR OU OBTER "VEZES 10" ===
  const nameX10 = `${baseName} X10`;
  let commandsX10 = [];
  commandsX10.push({ code: 'ESPIRITO', text: createInitCommand(nameX10) });
  for (let i = 0; i < 10; i++) {
    commandsX10.push({ code: 'ESPIRITO', text: createActivationCommand(baseName) });
  }
  commandsX10.push({ code: 'ESPIRITO', text: createEndCommand(nameX10) });

  // Adicionar à sequência de montagem (usuário terá que ler/ouvir isso para criar)
  assemblySequence.push(...commandsX10.map((cmd, idx) => ({
    sequenceId: idx + 1,
    ...cmd,
    note: 'Montando X10'
  })));

  // === PASSO 2: CRIAR OU OBTER "VEZES 100" ===
  const nameX100 = `${baseName} X100`;
  let commandsX100 = [];
  commandsX100.push({ code: 'ESPIRITO', text: createInitCommand(nameX100) });
  for (let i = 0; i < 10; i++) {
    commandsX100.push({ code: 'ESPIRITO', text: createActivationCommand(nameX10) });
  }
  commandsX100.push({ code: 'ESPIRITO', text: createEndCommand(nameX100) });

  assemblySequence.push(...commandsX100.map((cmd, idx) => ({
    sequenceId: assemblySequence.length + idx + 1,
    ...cmd,
    note: 'Montando X100'
  })));

  // === PASSO 3: CRIAR OU OBTER "VEZES 1000" ===
  const nameX1000 = `${baseName} X1000`;
  let commandsX1000 = [];
  commandsX1000.push({ code: 'ESPIRITO', text: createInitCommand(nameX1000) });
  for (let i = 0; i < 10; i++) {
    commandsX1000.push({ code: 'ESPIRITO', text: createActivationCommand(nameX100) });
  }
  commandsX1000.push({ code: 'ESPIRITO', text: createEndCommand(nameX1000) });

  assemblySequence.push(...commandsX1000.map((cmd, idx) => ({
    sequenceId: assemblySequence.length + idx + 1,
    ...cmd,
    note: 'Montando X1000'
  })));

  // === PASSO 4: ATIVAÇÃO FINAL DO 1000x ===
  const finalActivation = {
    sequenceId: assemblySequence.length + 1,
    code: 'ESPIRITO',
    text: createActivationCommand(nameX1000),
    note: 'POTENCIALIZAÇÃO FINAL'
  };
  assemblySequence.push(finalActivation);

  // Atualizar status no banco
  await supabase.from('user_procedures')
    .update({
      activated_1000x: true,
      activated_1000x_at: new Date().toISOString()
    })
    .eq('id', procedure_id);

  return {
    success: true,
    procedure: originalProc,
    activated1000x: true,
    assemblySequence,
    explanation: "A técnica de potencialização cria uma cascata de ativações (10 -> 100 -> 1000). A sequência gerada inclui a montagem dos 3 níveis e a ativação final."
  };
}


// =====================================================
// HELPERS
// =====================================================
function extractEventEssence(event: string): string {
  let essence = event.replace(/^["']|["']$/g, '');
  essence = essence.replace(/[,.]?\s*$/, '').trim();
  return essence;
}

async function saveUserProtocol(supabase: any, userId: string, sessionId: string | undefined, protocolTypeKey: string, data: any) {
  try {
    const { error } = await supabase.from('user_protocols').insert({
      user_id: userId,
      session_id: sessionId,
      protocol_type_key: protocolTypeKey,
      ...data
    });
    if (error) console.error('Error saving user protocol:', error);
  } catch (e) {
    console.error('Error saving user protocol:', e);
  }
}