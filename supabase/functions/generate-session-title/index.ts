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
    const { sessionId } = await req.json();
    console.log(`Generating title for session: ${sessionId}`);

    if (!sessionId) {
      throw new Error('Session ID é obrigatório');
    }

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key não configurada');
    }

    // Buscar mensagens da sessão
    const { data: messages, error: messagesError } = await supabase
      .from('session_messages')
      .select('content, role, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10); // Últimas 10 mensagens para contexto

    if (messagesError) {
      throw new Error(`Erro ao buscar mensagens: ${messagesError.message}`);
    }

    if (!messages || messages.length === 0) {
      // Se não há mensagens, usar título padrão
      await supabase
        .from('therapy_sessions')
        .update({ 
          auto_generated_title: 'Nova Sessão',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      return new Response(JSON.stringify({
        success: true,
        title: 'Nova Sessão'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preparar contexto das mensagens
    const conversationContext = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ')
      .substring(0, 1000); // Limitar tamanho

    console.log(`Generating title from conversation context: ${conversationContext.substring(0, 100)}...`);

    // Gerar título via OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente que cria títulos concisos e empáticos para sessões de terapia. 
            
            Regras:
            - Máximo 4-6 palavras
            - Sem usar palavras como "sessão", "terapia", "consulta"
            - Capture o tema emocional principal
            - Use linguagem acolhedora e positiva
            - Exemplos: "Lidando com Ansiedade", "Superando Medos", "Encontrando Equilíbrio", "Cura do Coração"`
          },
          {
            role: 'user',
            content: `Crie um título para uma sessão baseada neste contexto de conversa: ${conversationContext}`
          }
        ],
        temperature: 0.7,
        max_tokens: 20
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedTitle = data.choices[0].message.content.trim();

    console.log(`Generated title: ${generatedTitle}`);

    // Validar e limpar título
    let finalTitle = generatedTitle
      .replace(/["""]/g, '') // Remove aspas
      .substring(0, 50) // Máximo 50 caracteres
      .trim();

    if (!finalTitle || finalTitle.length < 3) {
      finalTitle = 'Sessão de Cura';
    }

    // Atualizar título na sessão
    const { error: updateError } = await supabase
      .from('therapy_sessions')
      .update({ 
        auto_generated_title: finalTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Erro ao atualizar título: ${updateError.message}`);
    }

    // Rastrear uso
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: null, // Será preenchido pelo RLS
        service: 'openai',
        operation_type: 'title_generation',
        tokens_used: 50,
        cost_usd: 0.01,
        metadata: {
          session_id: sessionId,
          generated_title: finalTitle,
          context_length: conversationContext.length
        }
      });

    return new Response(JSON.stringify({
      success: true,
      title: finalTitle
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-session-title function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});