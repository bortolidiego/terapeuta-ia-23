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
    console.log(`Pausing session: ${sessionId}`);

    if (!sessionId) {
      throw new Error('Session ID é obrigatório');
    }

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Pausar a sessão
    const { error: pauseError } = await supabase
      .from('therapy_sessions')
      .update({ 
        status: 'paused', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', sessionId)
      .eq('status', 'active');

    if (pauseError) {
      throw new Error(`Erro ao pausar sessão: ${pauseError.message}`);
    }

    console.log(`Session ${sessionId} paused successfully`);

    // Verificar se há mensagens suficientes para gerar título
    const { data: messages, error: messagesError } = await supabase
      .from('session_messages')
      .select('id')
      .eq('session_id', sessionId);

    if (messagesError) {
      console.error(`Erro ao verificar mensagens: ${messagesError.message}`);
    } else if (messages && messages.length >= 1) {
      // Há pelo menos 1 mensagem, tentar gerar título
      console.log(`Attempting to generate title for session ${sessionId} with ${messages.length} messages`);
      
      try {
        await supabase.functions.invoke('generate-session-title', {
          body: { sessionId }
        });
        console.log(`Title generation initiated for session ${sessionId}`);
      } catch (titleError) {
        console.error(`Erro ao gerar título: ${titleError}`);
        // Não falhar por causa do título, apenas logar
      }
    } else {
      console.log(`Session ${sessionId} has no messages, skipping title generation`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Sessão pausada com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in pause-session function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});