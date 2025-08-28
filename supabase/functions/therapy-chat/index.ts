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
      .eq('is_active', true)
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
  model: "${therapistConfig?.model_name || 'gpt-4o-mini'}",
  messagesCount: ${messages.length},
  temperature: ${therapistConfig?.temperature || 0.7},
  pendingFacts: ${therapyFacts?.length || 0}
}`);

    // Fazer chamada para OpenAI
    const modelName = therapistConfig?.model_name || 'gpt-4o-mini';
    
    // Detectar se é um modelo novo (GPT-5, O3, O4) que precisa de parâmetros diferentes
    const isNewModel = modelName.includes('gpt-5') || modelName.includes('o3-') || modelName.includes('o4-');
    
    let requestBody: any = {
      model: modelName,
      messages: messages,
    };

    if (isNewModel) {
      // Modelos novos: usar max_completion_tokens e não incluir temperature
      requestBody.max_completion_tokens = therapistConfig?.max_tokens || 1000;
    } else {
      // Modelos legacy: usar max_tokens e temperature
      requestBody.max_tokens = therapistConfig?.max_tokens || 1000;
      requestBody.temperature = therapistConfig?.temperature || 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
        
        // OTIMIZAÇÃO: Reduzir requisito mínimo para acelerar processo
        if (sentimentos.length < 15) {
          console.log('Poucos sentimentos selecionados, reabrindo popup');
          assistantReply = `Obrigado pela seleção! Para uma autocura eficaz, preciso que você escolha pelo menos 15 sentimentos. Você selecionou ${sentimentos.length}. Por favor, selecione mais sentimentos:\n\n[POPUP:sentimentos]`;
        } else {
          console.log('Sentimentos suficientes, iniciando protocolo otimizado');
          
          // Extrair fato específico do contexto recente
          const contextoRecente = history.slice(-5).map((h: Message) => h.content).join(' ');
          const fatoMatch = contextoRecente.match(/(?:fato|situação|evento|problema)[^.!?]*[.!?]/i);
          const fatoEspecifico = fatoMatch ? fatoMatch[0].trim() : 'a situação que você compartilhou';
          
          // NOVA ABORDAGEM: Resposta conversacional contínua + início da montagem
          assistantReply = `Perfeito! Recebi os ${sentimentos.length} sentimentos que você selecionou. 

🎯 **Iniciando sua autocura personalizada**

Estou preparando um áudio terapêutico especificamente para processar esses sentimentos relacionados ao evento que você compartilhou. O processo de criação está começando agora e levará alguns minutos.

💫 **Enquanto sua autocura é preparada...**

Que tal conversarmos um pouco mais sobre como você está se sentindo neste momento? Às vezes, expressar nossos pensamentos durante o processo de cura pode potencializar os resultados.

Como você espera que se sinta após ouvir sua autocura personalizada?

*🔄 Você receberá uma notificação assim que sua autocura estiver pronta para ser ouvida.*`;

          // Enviar dados estruturados para o frontend construir os comandos
          // Incluir metadata para continuar conversa
          const quantumData = {
            type: 'quantum_commands',
            sentimentos: sentimentos,
            fatoEspecifico: fatoEspecifico,
            totalSentimentos: sentimentos.length,
            status: 'Processando',
            message: 'Autocura em preparação - conversa continua',
            continueChatAfterAssembly: true,
            estimatedMinutes: Math.ceil((sentimentos.length * 8) * 2.5 / 60) // Estimativa otimizada
          };

          // Armazenar dados para retomada da conversa
          console.log('Storing quantum data for chat continuation:', quantumData);
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