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
    const { message, sessionId, history = [] } = await req.json();
    
    console.log(`Processando mensagem: "${message.substring(0, 100)}..."`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      throw new Error('Configuração de ambiente incompleta');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração do terapeuta
    const { data: therapistConfig } = await supabase
      .from('therapist_config')
      .select('*')
      .single();

    // Buscar base de conhecimento
    const { data: knowledge } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('is_active', true);

    // Buscar fatos pendentes
    const { data: therapyFacts } = await supabase
      .from('therapy_facts')
      .select('*')
      .eq('status', 'pending')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    // Construir o system prompt usando therapist_config
    let systemPrompt = therapistConfig?.main_prompt || `Você é um assistente de psicoterapia compassivo e objetivo.

CONHECIMENTO ESPECIALIZADO:
${knowledge && knowledge.length > 0 ? knowledge.map(k => `
- ${k.title}: ${k.content}
${k.keywords ? `Palavras-chave: ${k.keywords}` : ''}
`).join('\n') : ''}

FATOS PENDENTES DESTA SESSÃO:
${therapyFacts && therapyFacts.length > 0 ? therapyFacts.map(f => `- ${f.fact_text} (ID: ${f.id})`).join('\n') : 'Nenhum fato pendente.'}

FORMATAÇÃO DE BOTÕES:
Use o formato: [BTN:id:texto] para criar botões interativos
Exemplo: [BTN:fato1:Primeira variação] [BTN:autocura_agora:Trabalhar sentimentos agora]`;

    // Adicionar conhecimento e fatos pendentes ao prompt configurável
    if (knowledge && knowledge.length > 0) {
      systemPrompt += `\n\nCONHECIMENTO ESPECIALIZADO:\n${knowledge.map(k => `- ${k.title}: ${k.content}${k.keywords ? `\nPalavras-chave: ${k.keywords}` : ''}`).join('\n')}`;
    }

    if (therapyFacts && therapyFacts.length > 0) {
      systemPrompt += `\n\nFATOS PENDENTES DESTA SESSÃO:\n${therapyFacts.map(f => `- ${f.fact_text} (ID: ${f.id})`).join('\n')}`;
    }

    // Preparar mensagens para OpenAI
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((h: Message) => ({
        role: h.role,
        content: h.content
      })),
      { role: "user", content: message }
    ];

    console.log(`Enviando para OpenAI: {
  model: "gpt-4o-mini",
  messagesCount: ${messages.length},
  temperature: 0.7,
  pendingFacts: ${therapyFacts?.length || 0}
}`);

    // Fazer chamada para OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: therapistConfig?.model_name || 'gpt-4o-mini',
        messages: messages,
        temperature: therapistConfig?.temperature || 0.7,
        max_tokens: therapistConfig?.max_tokens || 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro da OpenAI:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let assistantReply = data.choices[0].message.content;

    console.log(`Resposta da OpenAI recebida: {
  choices: ${data.choices?.length || 0},
  usage: ${JSON.stringify(data.usage)}
}`);

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
      const chosenFact = fatoSelecionadoMatch[1].replace(/["”“]/g, '').trim();
      console.log('Fato específico selecionado - ETAPA 2:', chosenFact);

      // Garantir que o fato selecionado esteja salvo como pendente nesta sessão (sem duplicar)
      const normalize = (t: string) => t.toLowerCase().trim();
      const { data: pendBefore, error: pendBeforeErr } = await supabase
        .from('therapy_facts')
        .select('id, fact_text')
        .eq('session_id', sessionId)
        .eq('status', 'pending');
      if (pendBeforeErr) console.error('Erro ao buscar pendentes (antes):', pendBeforeErr);

      const alreadyExists = (pendBefore || []).some((f: any) => normalize(f.fact_text) === normalize(chosenFact));
      if (!alreadyExists) {
        const { error: insertErr } = await supabase
          .from('therapy_facts')
          .insert({ session_id: sessionId, fact_text: chosenFact, status: 'pending' });
        if (insertErr) console.error('Erro ao inserir fato pendente:', insertErr);
      }

      // Contar pendentes desta sessão
      const { count: pendCount, error: countErr } = await supabase
        .from('therapy_facts')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('status', 'pending');
      if (countErr) console.error('Erro ao contar pendentes:', countErr);

      assistantReply = `ROUTER: FATO_ESPECIFICO | step=next_action\nPerfeito. Fato específico fixado: ${chosenFact}.\n\nComo deseja prosseguir:\n[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois] [BTN:show_pending_facts:Fatos pendentes (${pendCount || 0})] [BTN:recomecar_consulta:Recomeçar consulta]`;
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
        const { data: existing, error: existingErr } = await supabase
          .from('therapy_facts')
          .select('id, fact_text')
          .eq('session_id', sessionId)
          .eq('status', 'pending');
        if (existingErr) console.error('Erro ao verificar duplicidade:', existingErr);
        const exists = (existing || []).some((f: any) => normalize(f.fact_text) === normalize(factText));
        if (!exists) {
          const { error: insertError } = await supabase
            .from('therapy_facts')
            .insert({ session_id: sessionId, fact_text: factText, status: 'pending' });
          if (insertError) console.error('Erro ao salvar fato pendente:', insertError);
        }
      } catch (e) {
        console.error('Exceção ao salvar fato pendente:', e);
      }
      assistantReply = 'ROUTER: FATO_ESPECIFICO | step=saved_pending\nFato salvo para trabalharmos depois. Quando desejar, retomamos a autocura deste evento.';
    } else {
      // Normalização: converter listas numeradas/simples em botões de fato + opções de autocura
      const hasButtons = /\[BTN:[^:]+:[^\]]+\]/.test(assistantReply);
      const hasRouterHeader = !!routerMatch;
      if (!hasButtons) {
        const lines = assistantReply.split('\n');
        const itemRegex = /^\s*(?:\d+[)\.-]?\s+|[-*•]\s+)(.+)$/;
        const items = lines
          .map((l: string) => {
            const m = l.match(itemRegex);
            return m ? m[1].trim() : null;
          })
          .filter(Boolean) as string[];
        if (items.length >= 3) {
          const clean = (t: string) => t.replace(/[""\"]/g, '').trim().replace(/\.$/, '');
          const top3 = items.slice(0, 3).map(clean);
          const preamble = lines.filter(l => !itemRegex.test(l)).join('\n').trim();
          const buttonsLine = `[BTN:fato1:${top3[0]}] [BTN:fato2:${top3[1]}] [BTN:fato3:${top3[2]}]`;
          if (routerProtocol === 'FATO_ESPECIFICO') {
            assistantReply = [preamble, '', buttonsLine].join('\n').trim();
          } else if (!hasRouterHeader) {
            assistantReply = [`ROUTER: FATO_ESPECIFICO | step=choose_fact`, preamble, '', buttonsLine].join('\n').trim();
          }
        }
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

    return new Response(JSON.stringify({ 
      reply: assistantReply,
      usage: data.usage 
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