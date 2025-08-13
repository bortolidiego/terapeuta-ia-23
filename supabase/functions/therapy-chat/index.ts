import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    const { message, sessionId, history = [] } = await req.json();
    
    console.log(`[PERFORMANCE] Iniciando processamento da mensagem: "${message.substring(0, 50)}..."`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      throw new Error('Configuração de ambiente incompleta');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // OTIMIZAÇÃO: Executar consultas em paralelo
    const dbStartTime = performance.now();
    const [therapistConfigResult, knowledgeResult, therapyFactsResult] = await Promise.all([
      supabase.from('therapist_config').select('*').single(),
      supabase.from('knowledge_base').select('*'), // Removido .eq('active', true) - coluna não existe
      supabase.from('therapy_facts').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    ]);
    
    const dbTime = performance.now() - dbStartTime;
    console.log(`[PERFORMANCE] Consultas DB completadas em ${dbTime.toFixed(2)}ms`);

    const therapistConfig = therapistConfigResult.data;
    const knowledge = knowledgeResult.data;
    const therapyFacts = therapyFactsResult.data;

    // Classificação semântica inicial (roteador)
    const clfStartTime = performance.now();
    const recentHistory = (history || []).slice(-6).map((h: any) => `${h.role}: ${h.content}`).join(' | ');
    let routerIntent = 'UNKNOWN';
    let routerConfidence = 0;
    let routerJustification = '';
    let factVariations: string[] = [];
    let classificationUsage: any = null;

    try {
      const clfResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 200,
          messages: [
            { role: 'system', content: 'Você é um roteador terapêutico. Analise a mensagem e o contexto e classifique a intenção. Responda APENAS com JSON válido: {"intent":"FATO_ESPECIFICO|EXPLORACAO_GERAL|CRISE_RISCO|FOLLOW_UP","confidence":0-1,"justification":"...","fact_variations":["...","...","..."]}. Inclua fact_variations somente se intent="FATO_ESPECIFICO". Os textos devem ser curtos, concretos e em PT-BR.' },
            { role: 'user', content: `Mensagem: ${message}\nContexto recente: ${recentHistory}` }
          ]
        })
      });
      const clfData = await clfResp.json();
      classificationUsage = clfData?.usage || null;
      const raw = clfData?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      routerIntent = String(parsed.intent || 'UNKNOWN').toUpperCase();
      routerConfidence = Number(parsed.confidence || 0);
      routerJustification = String(parsed.justification || '');
      if (Array.isArray(parsed.fact_variations)) {
        factVariations = parsed.fact_variations.filter((s: any) => typeof s === 'string').slice(0,3);
      }
    } catch (e) {
      console.warn('Falha na classificação semântica, prosseguindo sem ela.', e);
    }
    const clfTime = performance.now() - clfStartTime;
    console.log(`[PERFORMANCE] Classificação inicial em ${clfTime.toFixed(2)}ms -> intent=${routerIntent} conf=${routerConfidence}`);

    // Se for fato específico com alta confiança, curto-circuitar com botões
    if (routerIntent === 'FATO_ESPECIFICO' && routerConfidence >= 0.6 && !/Fato selecionado:/i.test(message) && !/^(autocura_|autocura finalizada|Selecionado fato pendente)/i.test(message.trim().toLowerCase())) {
      const variations = factVariations.length >= 3 ? factVariations : [
        `Eu ${message}`,
        `Aconteceu que ${message}`,
        `Ontem/hoje ${message}`
      ];
      const buttonsLine = variations.slice(0,3).map((v, i) => `[BTN:fato${i+1}:${v}]`).join(' ');
      const quickReply = `ROUTER: FATO_ESPECIFICO | step=choose_fact\nVejo que você trouxe um fato específico. Por favor, escolha a melhor descrição do evento:\n\n${buttonsLine}`;
      const totalTime = performance.now() - startTime;
      console.log(`[PERFORMANCE] Resposta gerada via roteador em ${totalTime.toFixed(2)}ms`);
      return new Response(JSON.stringify({
        reply: quickReply,
        usage: classificationUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Construir o system prompt
    let systemPrompt = `Você é um assistente de psicoterapia compassivo baseado em Análise de Bioenergia de Alexander Lowen. Seu objetivo principal é ajudar o usuário a processar experiências específicas através da autocura quântica.

CONFIGURAÇÃO PERSONALIZADA:
${therapistConfig ? `
Nome: ${therapistConfig.name || 'Assistente'}
Especialidade: ${therapistConfig.specialty || 'Análise de Bioenergia'}
Abordagem: ${therapistConfig.approach || 'Terapêutica e acolhedora'}
Estilo: ${therapistConfig.style || 'Direto e empático'}
Personalidade: ${therapistConfig.personality || 'Compassiva e assertiva'}
` : ''}

CONHECIMENTO ESPECIALIZADO:
${knowledge && knowledge.length > 0 ? knowledge.map(k => `
- ${k.title}: ${k.content}
${k.keywords ? `Palavras-chave: ${k.keywords}` : ''}
`).join('\n') : ''}

FATOS PENDENTES DE OUTRAS SESSÕES:
${therapyFacts && therapyFacts.length > 0 ? therapyFacts.map(f => `- ${f.fact_text} (ID: ${f.id})`).join('\n') : 'Nenhum fato pendente.'}

DECISÃO DO ROTEADOR (classificação semântica):
- Intent: ${routerIntent} (confiança: ${routerConfidence.toFixed(2)})
- Diretriz:
  • Se FATO_ESPECIFICO: inicie ou mantenha o protocolo FATO_ESPECIFICO e ofereça 3 variações objetivas quando apropriado.
  • Se CRISE_RISCO: priorize acolhimento e avaliação de risco, use linguagem simples e recursos de segurança.
  • Se FOLLOW_UP: retome o tema anterior de forma objetiva antes de avançar.
  • Se EXPLORACAO_GERAL: conduza exploração até identificar um fato concreto.

PROTOCOLO DE ROTEAMENTO:
Sempre que você identificar uma conversa sobre um problema específico, siga o protocolo ROUTER. Prefixe sua resposta com uma das opções:

1. ROUTER: FATO_ESPECIFICO | step=choose_fact
   - Use quando o usuário mencionar um problema/situação específica
   - Ofereça 3 variações da situação como lista numerada para o usuário escolher

2. ROUTER: FATO_ESPECIFICO | step=pending_facts  
   - Use quando há fatos pendentes após seleção de fato
   - Liste fatos pendentes como botões + opção "novo problema"

3. ROUTER: FATO_ESPECIFICO | step=next_action
   - Use após seleção de fato quando não há pendentes
   - Ofereça: "Trabalhar sentimentos agora" ou "Autocurar depois"

4. ROUTER: FATO_ESPECIFICO | step=sentiments_popup
   - Use quando usuário escolher "trabalhar sentimentos agora"
   - Inclua [POPUP:sentimentos] para abrir seleção

5. ROUTER: POST_AUTOCURA | step=complete
   - Use após finalização da autocura
   - Pergunte se quer trabalhar outro problema ou encerrar

DIRETRIZES ESPECÍFICAS:
- Seja direto e eficiente
- Foque em fatos específicos, não teorias gerais
- Quando detectar um problema específico, entre no modo FATO_ESPECIFICO
- Transforme qualquer lista de situações em 3 variações numeradas
- Mantenha foco na experiência concreta do usuário
- Use linguagem acessível e acolhedora

FORMATAÇÃO DE BOTÕES:
Use o formato: [BTN:id:texto] para criar botões interativos
Exemplo: [BTN:fato1:Primeira variação] [BTN:autocura_agora:Trabalhar sentimentos agora]`;

    // OTIMIZAÇÃO: Limitar histórico para as últimas 20 mensagens
    const limitedHistory = history.slice(-20);
    const messages = [
      { role: "system", content: systemPrompt },
      ...limitedHistory.map((h: Message) => ({
        role: h.role,
        content: h.content
      })),
      { role: "user", content: message }
    ];

    console.log(`[PERFORMANCE] Enviando para OpenAI: {
  model: "gpt-4o-mini",
  messagesCount: ${messages.length} (limitado de ${history.length}),
  temperature: 0.7,
  max_tokens: 1500,
  pendingFacts: ${therapyFacts?.length || 0}
}`);

    // OTIMIZAÇÃO: Fazer chamada para OpenAI com timeout
    const openaiStartTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
    
    let assistantReply = '';
    let data: any = null;
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 1500, // Reduzido de 10000 para 1500
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const openaiTime = performance.now() - openaiStartTime;
      console.log(`[PERFORMANCE] OpenAI respondeu em ${openaiTime.toFixed(2)}ms`);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro da OpenAI:', errorData);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      data = await response.json();
      assistantReply = data.choices[0].message.content;

      console.log(`[PERFORMANCE] Resposta processada: {
  choices: ${data.choices?.length || 0},
  usage: ${JSON.stringify(data.usage)},
  prompt_tokens: ${data.usage?.prompt_tokens || 0},
  completion_tokens: ${data.usage?.completion_tokens || 0}
}`);
      
    } catch (timeoutError) {
      clearTimeout(timeoutId);
      console.error('[PERFORMANCE] Timeout na OpenAI:', timeoutError);
      
      // Fallback para timeout
      return new Response(JSON.stringify({ 
        reply: 'Desculpe, o sistema está um pouco lento no momento. Pode repetir sua mensagem?',
        error: 'timeout',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detectar ROUTER na resposta do modelo
    let routerProtocol = 'UNKNOWN';
    let routerStep = '';
    const routerMatch = assistantReply.match(/^\s*ROUTER:\s*([A-Z_]+)(?:\s*\|\s*step=([a-z0-9_:-]+))?/i);
    if (routerMatch) {
      routerProtocol = (routerMatch[1] || '').toUpperCase();
      routerStep = routerMatch[2] || '';
      console.log('Router detectado:', { routerProtocol, routerStep });
    }

    // **CORREÇÃO CRÍTICA**: Tratamento especial para seleção de fato específico
    const fatoSelecionadoMatch = message.match(/^\s*Fato selecionado:\s*(.+)/i);
    if (fatoSelecionadoMatch) {
      const chosenFact = fatoSelecionadoMatch[1].replace(/["""]/g, '').trim();
      console.log('Fato específico selecionado - ETAPA 2:', chosenFact);
      
      // Buscar fatos pendentes diretamente na base de dados para garantir dados atualizados
      const { data: fatosPendentes, error: fatosError } = await supabase
        .from('therapy_facts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (fatosError) {
        console.error('Erro ao buscar fatos pendentes:', fatosError);
      }
      
      console.log(`Fatos pendentes encontrados: ${fatosPendentes?.length || 0}`);
      
      if (fatosPendentes && fatosPendentes.length > 0) {
        let fatosPendentesText = '\n\nVocê tem outros fatos pendentes para autocura:\n';
        fatosPendentes.forEach((fato: any) => {
          fatosPendentesText += `[BTN:pending_fact_${fato.id}:${fato.fact_text}]\n`;
        });
        fatosPendentesText += '\n[BTN:new_problem:Trabalhar novo problema]';
        assistantReply = `ROUTER: FATO_ESPECIFICO | step=pending_facts\nPerfeito. Fato específico fixado: ${chosenFact}.${fatosPendentesText}`;
      } else {
        console.log('Nenhum fato pendente, mostrando opções de autocura para o fato atual');
        assistantReply = `ROUTER: FATO_ESPECIFICO | step=next_action\nPerfeito. Fato específico fixado: ${chosenFact}.\n\nAgora escolha como deseja prosseguir:\n[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]`;
      }
    } else if (message.trim().toLowerCase() === 'autocura_agora') {
      console.log('Fluxo: autocura agora');
      assistantReply = 'ROUTER: FATO_ESPECIFICO | step=sentiments_popup\nÓtimo. Vamos selecionar os sentimentos principais deste fato.\n\n[POPUP:sentimentos]';
    } else if (message.trim().toLowerCase() === 'autocura finalizada, retornar ao início') {
      console.log('Fluxo: retornando ao router após autocura');
      assistantReply = 'ROUTER: POST_AUTOCURA | step=complete\nSua autocura foi finalizada com sucesso! ✨\n\nPosso ajudá-lo com algo mais hoje?\n\n[BTN:sim:Sim, quero trabalhar outro problema] [BTN:encerrar:Encerrar consulta]';
    } else if (message.trim().toLowerCase() === 'autocura_depois') {
      console.log('Fluxo: autocura depois');
      // Encontrar último fato selecionado no histórico recente
      const lastFactMsg = [...history].reverse().find((m: Message) => /^(?:Fato selecionado:)/i.test(m.content));
      const factText = lastFactMsg ? lastFactMsg.content.split(':').slice(1).join(':').trim() : 'fato específico desta sessão';
      try {
        const { error: insertError } = await supabase
          .from('therapy_facts')
          .insert({ session_id: sessionId, fact_text: factText, status: 'pending' });
        if (insertError) console.error('Erro ao salvar fato pendente:', insertError);
      } catch (e) {
        console.error('Exceção ao salvar fato pendente:', e);
      }
      assistantReply = 'ROUTER: FATO_ESPECIFICO | step=saved_pending\nFato salvo para trabalharmos depois. Quando desejar, retomamos a autocura deste evento.';
    } else {
      // Normalização: converter listas numeradas/simples em botões de fato + opções de autocura
      const hasButtons = /\[BTN:[^:]+:[^\]]+\]/.test(assistantReply);
      const hasRouterHeader = !!routerMatch;
      
      // Verificar se a resposta contém problemas/situações específicas que devem ser convertidas em botões
      if (!hasButtons && !hasRouterHeader) {
        const lines = assistantReply.split('\n');
        const itemRegex = /^\s*(?:\d+[)\.-]?\s+|[-*•]\s+)(.+)$/;
        const items = lines
          .map((l: string) => {
            const m = l.match(itemRegex);
            return m ? m[1].trim() : null;
          })
          .filter(Boolean) as string[];
          
        // Se encontrou 3 ou mais itens, converter em botões de fato específico
        if (items.length >= 3) {
          const clean = (t: string) => t.replace(/[""\"]/g, '').trim().replace(/\.$/, '');
          const top3 = items.slice(0, 3).map(clean);
          const preamble = lines.filter(l => !itemRegex.test(l)).join('\n').trim();
          const buttonsLine = `[BTN:fato1:${top3[0]}] [BTN:fato2:${top3[1]}] [BTN:fato3:${top3[2]}]`;
          
          assistantReply = [`ROUTER: FATO_ESPECIFICO | step=choose_fact`, preamble, '', buttonsLine].join('\n').trim();
        }
        // Heurística de detecção baseada em palavras-chave removida em favor do roteador semântico
        // (mantemos apenas a conversão de listas em botões como fallback)

      }
    }

    // Detecta se o usuário está enviando sentimentos selecionados
    if (message.includes('Sentimentos selecionados:')) {
      console.log('Detectando sentimentos selecionados');
      
      // Extrai e normaliza os sentimentos
      const sentimentosMatch = message.match(/Sentimentos selecionados:\s*(.+)/);
      if (sentimentosMatch) {
        const sentimentosText = sentimentosMatch[1];
        const sentimentos = sentimentosText
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(s => s.length > 0);
        
        console.log(`Sentimentos extraídos: ${sentimentos.length} itens`);
        
        // Valida se tem pelo menos 40 sentimentos
        if (sentimentos.length < 40) {
          console.log('Poucos sentimentos selecionados, reabrindo popup');
          assistantReply = `Obrigado pela seleção! Porém, preciso que você escolha pelo menos 40 sentimentos para prosseguirmos com eficácia. Você selecionou ${sentimentos.length}. Por favor, selecione mais sentimentos:\n\n[POPUP:sentimentos]`;
        } else {
          console.log('Sentimentos suficientes, gerando template para comandos quânticos');
          
          // Extrair fato específico do contexto recente
          const contextoRecente = history.slice(-5).map((h: Message) => h.content).join(' ');
          const fatoMatch = contextoRecente.match(/(?:fato|situação|evento|problema)[^.!?]*[.!?]/i);
          const fatoEspecifico = fatoMatch ? fatoMatch[0].trim() : 'a situação que você compartilhou';
          
          // Enviar dados estruturados para o frontend construir os comandos
          assistantReply = JSON.stringify({
            type: 'quantum_commands',
            sentimentos: sentimentos,
            fatoEspecifico: fatoEspecifico,
            totalSentimentos: sentimentos.length,
            status: 'Autocura EMITIDA',
            message: `Perfeito! Com base nos ${sentimentos.length} sentimentos selecionados, aqui estão seus comandos quânticos personalizados:`,
            postMessage: '\n\n[BTN:finalizar:Finalizar autocura]'
          });
        }
      }
    }

    // Analisar a mensagem para possíveis gatilhos de conhecimento
    const messageWords = message.toLowerCase().split(' ');
    let triggeredKnowledge = '';
    
    if (knowledge) {
      for (const item of knowledge) {
        const keywords = item.title.toLowerCase().split(' ');
        const hasKeywordMatch = keywords.some(keyword => 
          messageWords.some(word => word.includes(keyword) || keyword.includes(word))
        );
        
        if (hasKeywordMatch) {
          triggeredKnowledge += `\n\n**${item.title}:**\n${item.content}`;
        }
      }
    }

    // Adicionar conhecimento disparado à resposta se houver
    if (triggeredKnowledge) {
      assistantReply += triggeredKnowledge;
    }

    // Log de performance final
    const totalTime = performance.now() - startTime;
    console.log(`[PERFORMANCE] Processamento total completado em ${totalTime.toFixed(2)}ms`);

    return new Response(JSON.stringify({ 
      reply: assistantReply,
      usage: data?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função therapy-chat:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});