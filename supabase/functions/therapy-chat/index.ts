import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: string;
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId, history } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração do terapeuta
    const { data: config, error: configError } = await supabase
      .from('therapist_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('Erro ao buscar configuração:', configError);
      throw new Error('Configuração do terapeuta não encontrada');
    }

    // Buscar base de conhecimento ativa
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('knowledge_base')
      .select('title, content, category')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (knowledgeError) {
      console.error('Erro ao buscar base de conhecimento:', knowledgeError);
    }

    // Buscar fatos pendentes da sessão
    const { data: therapyFacts, error: factsError } = await supabase
      .from('therapy_facts')
      .select('id, fact_text, status')
      .eq('status', 'pending')
      .eq('session_id', sessionId);

    if (factsError) {
      console.error('Erro ao buscar therapy_facts:', factsError);
    }

    // Construir prompt system: usar SEMPRE o main_prompt (Router Prompt definido como padrão no DB)
    let systemPrompt = config.main_prompt;

    // Incluir fatos pendentes no prompt (se houver)
    if (typeof therapyFacts !== 'undefined' && therapyFacts && therapyFacts.length > 0) {
      systemPrompt += '\n\n=== FATOS PENDENTES (contexto da sessão) ===';
      therapyFacts.forEach((f: { id: string; fact_text: string; status: string }) => {
        systemPrompt += `\n- [ID ${f.id}] ${f.fact_text} (status: ${f.status})`;
      });
      systemPrompt += '\nUse estes fatos para orientar as próximas perguntas e decisões.';
    }
    
    if (knowledge && knowledge.length > 0) {
      systemPrompt += '\n\n=== INSTRUÇÕES PARA USO DA BASE DE CONHECIMENTO ===';
      systemPrompt += '\nVocê tem acesso a informações específicas organizadas por categoria. Siga estas regras:';
      systemPrompt += '\n1. SEMPRE verifique se há informações relevantes na base de conhecimento antes de responder';
      systemPrompt += '\n2. Quando encontrar informações relevantes, siga EXATAMENTE o protocolo descrito';
      systemPrompt += '\n3. Se há um fluxo específico descrito, execute cada etapa em sequência';
      systemPrompt += '\n4. NÃO misture diferentes protocolos - foque no mais relevante para a situação';
      systemPrompt += '\n5. Se não há protocolo específico, use as informações como contexto auxiliar';
      
      systemPrompt += '\n\n=== BASE DE CONHECIMENTO DISPONÍVEL ===';
      
      // Organizar conhecimento por categoria
      const knowledgeByCategory: {[key: string]: any[]} = {};
      knowledge.forEach(item => {
        if (!knowledgeByCategory[item.category]) {
          knowledgeByCategory[item.category] = [];
        }
        knowledgeByCategory[item.category].push(item);
      });
      
      // Adicionar cada categoria de forma estruturada
      Object.entries(knowledgeByCategory).forEach(([category, items]) => {
        systemPrompt += `\n\n[CATEGORIA: ${category.toUpperCase()}]`;
        items.forEach(item => {
          systemPrompt += `\n\n📋 PROTOCOLO: ${item.title}`;
          systemPrompt += `\n${item.content}`;
          systemPrompt += '\n---';
        });
      });
      
      systemPrompt += '\n\n=== SISTEMA DE BOTÕES INTERATIVOS ===';
      systemPrompt += '\nQuando uma etapa requer seleção de opções pelo usuário, você pode criar botões clicáveis usando:';
      systemPrompt += '\n\n**FORMATO JSON (para casos complexos):**';
      systemPrompt += '\n```json';
      systemPrompt += '\n{"type": "buttons", "message": "Pergunta aqui", "options": [{"id": "opcao1", "text": "Opção 1"}, {"id": "opcao2", "text": "Opção 2"}]}'
      systemPrompt += '\n```';
      systemPrompt += '\n\n**FORMATO MARKDOWN (para casos simples):**';
      systemPrompt += '\n[BTN:opcao1:Opção 1] [BTN:opcao2:Opção 2]';
      systemPrompt += '\n\nQuando o usuário selecionar uma opção, você receberá o ID da opção como mensagem. Continue o fluxo baseado na seleção.';
      systemPrompt += '\n\n=== INSTRUÇÃO FINAL ===';
      systemPrompt += '\nAntes de cada resposta, identifique:';
      systemPrompt += '\n- Qual categoria da base de conhecimento se aplica (se alguma)';
      systemPrompt += '\n- Se há um protocolo específico a seguir';
      systemPrompt += '\n- Em que etapa do protocolo o usuário está';
      systemPrompt += '\n- Se esta etapa requer botões de seleção';
      systemPrompt += '\nEntão, execute o protocolo apropriado ou responda seguindo suas instruções principais.';
      
    }

    // Adicionar instruções de botões quando não houver knowledge (para manter consistência de formato)
    if (!knowledge || knowledge.length === 0) {
      systemPrompt += '\n\n=== SISTEMA DE BOTÕES INTERATIVOS ===';
      systemPrompt += '\nQuando uma etapa requer seleção de opções pelo usuário, você pode criar botões clicáveis usando:';
      systemPrompt += '\n\n**FORMATO JSON (para casos complexos):**';
      systemPrompt += '\n```json';
      systemPrompt += '\n{"type": "buttons", "message": "Pergunta aqui", "options": [{"id": "opcao1", "text": "Opção 1"}, {"id": "opcao2", "text": "Opção 2"}]}'
      systemPrompt += '\n```';
      systemPrompt += '\n\n**FORMATO MARKDOWN (para casos simples):**';
      systemPrompt += '\n[BTN:opcao1:Opção 1] [BTN:opcao2:Opção 2]';
      systemPrompt += '\n\nQuando o usuário selecionar uma opção, você receberá o ID da opção como mensagem. Continue o fluxo baseado na seleção.';
    }

    // Router de protocolos (sempre ativo)
    systemPrompt += '\n\n=== ROUTER DE PROTOCOLOS ===';
    systemPrompt += '\nAntes de responder, classifique o pedido do usuário em um protocolo e INICIE a resposta com:';
    systemPrompt += '\nROUTER: <PROTOCOLO> | step=<etapa_atual>';
    systemPrompt += '\nProtocolos possíveis:';
    systemPrompt += '\n- FATO_ESPECIFICO: Quando há um único evento concreto no tempo. Evite quando são relatos genéricos ou recorrentes.';
    systemPrompt += '\n- GERAL: Conversa geral, perguntas amplas, orientação sem evento único.';
    systemPrompt += '\n- KB:<NOME>: Quando algum protocolo específico da Base de Conhecimento se aplica.';
    systemPrompt += '\nRegras:';
    systemPrompt += '\n- Só use FATO_ESPECIFICO se houver um evento único, datável. Caso contrário, use GERAL ou KB.';
    systemPrompt += '\n- Se FATO_ESPECIFICO, gere exatamente 3 variações do FATO e os botões de autocura conforme instruções do protocolo abaixo.';
    systemPrompt += '\n- Use botões [BTN:id:texto] quando a etapa exigir escolha do usuário.';

    // Protocolo de FATO ESPECÍFICO (sempre disponível)
    systemPrompt += '\n\n=== SISTEMA DE AUTOCURA E FATOS (FATO ESPECÍFICO) ===';
    systemPrompt += '\nQuando o usuário mencionar um FATO ESPECÍFICO (um evento concreto no tempo):';
    systemPrompt += '\n1. Crie EXATAMENTE 3 variações APENAS DO FATO, curtas e objetivas, descrevendo somente QUANDO e O QUE aconteceu.';
    systemPrompt += "\n   - PROIBIDO: emoções, julgamentos ou adjetivos (ex.: 'foi tenso', 'fiquei desolado', 'me senti...').";
    systemPrompt += '\n   - NÃO use aspas nas variações.';
    systemPrompt += '\n2. Use SEMPRE botões em UMA ÚNICA LINHA no formato: [BTN:fato1:Variação 1] [BTN:fato2:Variação 2] [BTN:fato3:Variação 3].';
    systemPrompt += '\n3. Logo ABAIXO, em UMA ÚNICA LINHA, ofereça: [BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois].';
    systemPrompt += '\n4. NÃO usar listas numeradas ou marcadores para as variações. SEMPRE use botões.';
    systemPrompt += '\n5. Emoções SÓ entram após o usuário escolher autocura_agora.';

    // Preparar mensagens para OpenAI
    const messages: Array<{role: string, content: string}> = [
      {
        role: 'system',
        content: systemPrompt
      },
      // Adicionar histórico limitado (últimas 25 mensagens)
      ...history.slice(-25).map((msg: Message) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    console.log('Enviando para OpenAI:', { 
      model: config.model_name, 
      messagesCount: messages.length,
      temperature: config.temperature 
    });

    // Chamar OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model_name,
        messages: messages,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro da OpenAI:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta da OpenAI recebida:', { 
      choices: data.choices?.length,
      usage: data.usage 
    });

    let assistantReply = data.choices[0].message.content;

    // Detectar ROUTER na resposta do modelo
    let routerProtocol = 'UNKNOWN';
    let routerStep = '';
    const routerMatch = assistantReply.match(/^\s*ROUTER:\s*([A-Z_]+)(?:\s*\|\s*step=([a-z0-9_:-]+))?/i);
    if (routerMatch) {
      routerProtocol = (routerMatch[1] || '').toUpperCase();
      routerStep = routerMatch[2] || '';
      console.log('Router detectado:', { routerProtocol, routerStep });
    }

    // Tratamento especial para o fluxo de FATO ESPECÍFICO
    const fatoSelecionadoMatch = message.match(/^\s*Fato selecionado:\s*(.+)/i);
    if (fatoSelecionadoMatch) {
      const chosenFact = fatoSelecionadoMatch[1].replace(/[“”"]/g, '').trim();
      console.log('Fato específico selecionado:', chosenFact);
      assistantReply = `ROUTER: FATO_ESPECIFICO | step=next_action\nPerfeito. Fato específico fixado: ${chosenFact}.\n\nAgora escolha como deseja prosseguir:\n[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]`;
    } else if (message.trim().toLowerCase() === 'autocura_agora') {
      console.log('Fluxo: autocura agora');
      assistantReply = 'ROUTER: FATO_ESPECIFICO | step=sentiments_popup\nÓtimo. Vamos selecionar os sentimentos principais deste fato.\n\n[POPUP:sentimentos]';
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
          const clean = (t: string) => t.replace(/[“”"]/g, '').trim().replace(/\.$/, '');
          const top3 = items.slice(0, 3).map(clean);
          const preamble = lines.filter(l => !itemRegex.test(l)).join('\n').trim();
          assistantReply = [
            preamble,
            '',
            `[BTN:fato1:${top3[0]}] [BTN:fato2:${top3[1]}] [BTN:fato3:${top3[2]}]`,
            `[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]`
          ].join('\n').trim();
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
            message: `Perfeito! Com base nos ${sentimentos.length} sentimentos selecionados, aqui estão seus comandos quânticos personalizados:`
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
        const hasKeyword = keywords.some(keyword => 
          messageWords.some(word => word.includes(keyword) || keyword.includes(word))
        );
        
        if (hasKeyword && !triggeredKnowledge.includes(item.title)) {
          triggeredKnowledge += `\n\n💡 Informação adicional sobre ${item.title}:\n${item.content}`;
        }
      }
    }

    const finalReply = assistantReply + triggeredKnowledge;

    return new Response(
      JSON.stringify({ 
        reply: finalReply,
        usage: data.usage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na função therapy-chat:', error);
    
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message,
        reply: 'Desculpe, houve um problema técnico. Tente novamente em alguns momentos.' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
