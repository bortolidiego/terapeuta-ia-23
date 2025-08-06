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

    // Construir prompt system estruturado
    let systemPrompt = config.main_prompt;
    
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
      systemPrompt += '\n{"type": "buttons", "message": "Pergunta aqui", "options": [{"id": "opcao1", "text": "Opção 1"}, {"id": "opcao2", "text": "Opção 2"}]}';
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

    // Preparar mensagens para OpenAI
    const messages: Array<{role: string, content: string}> = [
      {
        role: 'system',
        content: systemPrompt
      },
      // Adicionar histórico limitado (últimas 10 mensagens)
      ...history.slice(-10).map((msg: Message) => ({
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

    const assistantReply = data.choices[0].message.content;

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
        error: error.message,
        reply: 'Desculpe, houve um problema técnico. Tente novamente em alguns momentos.' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});