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
    const { 
      userId, 
      service, 
      operationType, 
      tokensUsed, 
      costUsd, 
      metadata = {} 
    } = await req.json();

    console.log(`Tracking credit usage for user: ${userId}, service: ${service}, cost: $${costUsd}`);

    if (!userId || !service || !operationType || tokensUsed === undefined || costUsd === undefined) {
      throw new Error('Parâmetros obrigatórios: userId, service, operationType, tokensUsed, costUsd');
    }

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Registrar o uso na tabela de tracking
    const { error: trackingError } = await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        service,
        operation_type: operationType,
        tokens_used: tokensUsed,
        cost_usd: costUsd,
        metadata
      });

    if (trackingError) {
      throw new Error(`Erro ao registrar tracking: ${trackingError.message}`);
    }

    // Buscar créditos atuais do usuário
    const { data: currentCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError) {
      throw new Error(`Erro ao buscar créditos: ${creditsError.message}`);
    }

    // Calcular novos valores baseado no serviço
    let updateData: any = {};
    
    if (service === 'openai') {
      const newCredits = Math.max(0, (currentCredits.openai_credits || 0) - tokensUsed);
      const newSpent = (currentCredits.total_spent_openai || 0) + costUsd;
      
      updateData = {
        openai_credits: newCredits,
        total_spent_openai: newSpent
      };

      // Verificar se créditos estão baixos (menos de 100)
      if (newCredits < 100 && (currentCredits.openai_credits || 0) >= 100) {
        await supabase
          .from('user_notifications')
          .insert({
            user_id: userId,
            type: 'low_credits',
            title: 'Créditos OpenAI Baixos',
            message: `Você tem apenas ${newCredits} créditos OpenAI restantes. Considere comprar mais créditos para continuar usando nossos serviços.`,
            metadata: {
              service: 'openai',
              remaining_credits: newCredits
            }
          });
      }

    } else if (service === 'elevenlabs') {
      const newCredits = Math.max(0, (currentCredits.elevenlabs_credits || 0) - tokensUsed);
      const newSpent = (currentCredits.total_spent_elevenlabs || 0) + costUsd;
      
      updateData = {
        elevenlabs_credits: newCredits,
        total_spent_elevenlabs: newSpent
      };

      // Verificar se créditos estão baixos (menos de 50)
      if (newCredits < 50 && (currentCredits.elevenlabs_credits || 0) >= 50) {
        await supabase
          .from('user_notifications')
          .insert({
            user_id: userId,
            type: 'low_credits',
            title: 'Créditos ElevenLabs Baixos',
            message: `Você tem apenas ${newCredits} créditos ElevenLabs restantes. Considere comprar mais créditos para continuar gerando áudios.`,
            metadata: {
              service: 'elevenlabs',
              remaining_credits: newCredits
            }
          });
      }
    }

    // Atualizar créditos do usuário
    const { error: updateError } = await supabase
      .from('user_credits')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Erro ao atualizar créditos: ${updateError.message}`);
    }

    console.log(`Credit tracking completed for user: ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Uso de créditos registrado com sucesso',
      remaining_credits: service === 'openai' ? updateData.openai_credits : updateData.elevenlabs_credits,
      total_spent: service === 'openai' ? updateData.total_spent_openai : updateData.total_spent_elevenlabs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in credit-tracking function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});