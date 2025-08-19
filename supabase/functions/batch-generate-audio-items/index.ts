import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper para retry com backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 3000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isRateLimit = error.message?.includes('429') || 
                          error.message?.includes('too_many_concurrent_requests') ||
                          error.message?.includes('rate limit');
      
      if (isLastAttempt || !isRateLimit) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 2000;
      console.log(`Rate limit hit, retrying attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userId, type = 'all', sentiments } = await req.json();
    console.log(`Starting batch audio generation for session: ${sessionId}, user: ${userId}, type: ${type}`);

    if (!sessionId || !userId) {
      throw new Error('Session ID e User ID são obrigatórios');
    }

    // Validar type para sentimentos
    if (type === 'sentiments' && (!sentiments || !Array.isArray(sentiments) || sentiments.length === 0)) {
      throw new Error('Lista de sentimentos é obrigatória para type=sentiments');
    }

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key não configurada');
    }

    // Buscar perfil do usuário para obter voice_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('cloned_voice_id, full_name')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      throw new Error('Perfil do usuário não encontrado');
    }

    const voiceId = profile.cloned_voice_id || 'pNInz6obpgDQGcFmaJgB'; // Fallback para voz padrão
    const userName = profile.full_name || 'amigo';

    let successfulBase = [];
    let failedBase = [];
    let successfulSentiments = [];
    let failedSentiments = [];
    let baseFragments = [];
    let limitedSentiments = [];

    // Processar apenas o tipo solicitado
    if (type === 'all' || type === 'base_words') {
      // Buscar fragmentos base para protocolo específico
      const { data: fragments, error: fragmentsError } = await supabase
        .from('audio_components')
        .select('*')
        .eq('is_available', true)
        .eq('protocol_type', 'evento_traumatico_especifico')
        .eq('component_type', 'base_word');

      if (fragmentsError) {
        throw new Error(`Erro ao buscar fragmentos: ${fragmentsError.message}`);
      }

      baseFragments = fragments || [];
      console.log(`Found ${baseFragments.length} available base fragments`);

      // Processar fragmentos base - sequencialmente com retry
      for (const fragment of baseFragments) {
        try {
          console.log(`Generating base fragment: ${fragment.component_key}`);
          await retryWithBackoff(() => 
            generateBaseFragment(supabase, {
              fragment,
              sessionId,
              userId,
              userName,
              voiceId,
              elevenLabsApiKey
            })
          );
          successfulBase.push(fragment.component_key);
        } catch (error: any) {
          console.error(`Failed to generate base fragment ${fragment.component_key}:`, error.message);
          failedBase.push({ key: fragment.component_key, error: error.message });
        }
        
        // Pausa entre cada fragmento
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (type === 'all' || type === 'sentiments') {
      // Limitar sentimentos a 10 para evitar sobrecarga
      limitedSentiments = sentiments ? sentiments.slice(0, 10) : [];
      console.log(`Processing ${limitedSentiments.length} sentiments for user: ${userName}, voice: ${voiceId}`);

      // Processar sentimentos - sequencialmente com retry
      for (const sentiment of limitedSentiments) {
        try {
          console.log(`Generating sentiment audio: ${sentiment}`);
          await retryWithBackoff(() => 
            generateSentimentAudio(supabase, {
              sentiment,
              sessionId,
              userId,
              userName,
              voiceId,
              elevenLabsApiKey
            })
          );
          successfulSentiments.push(sentiment);
        } catch (error: any) {
          console.error(`Failed to generate sentiment ${sentiment}:`, error.message);
          failedSentiments.push({ sentiment, error: error.message });
        }
        
        // Pausa entre cada sentimento
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Contar resultados totais - corrigindo o erro de length
    const totalSuccessful = (successfulBase || []).length + (successfulSentiments || []).length;
    const totalFailed = (failedBase || []).length + (failedSentiments || []).length;
    const totalItems = (baseFragments || []).length + (limitedSentiments || []).length;

    console.log(`Batch generation completed: ${totalSuccessful} successful, ${totalFailed} failed`);

    // Criar notificação para o usuário
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'audio_generation',
        title: 'Geração de Biblioteca Concluída',
        message: `${totalSuccessful} áudios foram criados com sucesso. ${totalFailed > 0 ? `${totalFailed} falharam.` : ''}`,
        metadata: {
          session_id: sessionId,
          successful_count: totalSuccessful,
          failed_count: totalFailed,
          total_fragments: totalItems,
          successful_base: successfulBase.length,
          successful_sentiments: successfulSentiments.length,
          failed_details: [...failedBase, ...failedSentiments],
          limited_sentiments: limitedSentiments
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: `Geração em lote concluída`,
      results: {
        total: totalItems,
        successful: totalSuccessful,
        failed: totalFailed,
        base_fragments: {
          total: baseFragments.length,
          successful: successfulBase.length,
          failed: failedBase.length
        },
        sentiments: {
          requested: sentiments.length,
          processed: limitedSentiments.length,
          successful: successfulSentiments.length,
          failed: failedSentiments.length
        },
        details: {
          successful_base,
          successful_sentiments,
          failed_base: failedBase,
          failed_sentiments: failedSentiments
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-generate-audio-items function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateBaseFragment(supabase: any, options: {
  fragment: any;
  sessionId: string;
  userId: string;
  userName: string;
  voiceId: string;
  elevenLabsApiKey: string;
}) {
  const { fragment, sessionId, userId, userName, voiceId, elevenLabsApiKey } = options;
  
  try {
    console.log(`Generating base fragment: ${fragment.component_key}`);

    // Usar texto do fragmento sem modificações (já está pronto)
    const textToGenerate = fragment.text_content;

    // Gerar áudio via ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: textToGenerate,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioPath = `user-audio-library/${userId}/${sessionId}/${fragment.component_key}-${Date.now()}.mp3`;

    // Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio-assembly')
      .upload(audioPath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // Salvar na biblioteca do usuário
    const { error: libraryError } = await supabase
      .from('user_audio_library')
      .insert({
        user_id: userId,
        component_key: fragment.component_key,
        component_type: 'base_word',
        sentiment_name: null,
        audio_path: audioPath,
        generation_method: 'elevenlabs_tts',
        status: 'completed'
      });

    if (libraryError) {
      throw new Error(`Erro ao salvar na biblioteca: ${libraryError.message}`);
    }

    // Rastrear uso de créditos
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        service: 'elevenlabs',
        operation_type: 'text_to_speech',
        tokens_used: textToGenerate.length,
        cost_usd: 0.30, // Estimativa
        metadata: {
          fragment_key: fragment.component_key,
          voice_id: voiceId,
          text_length: textToGenerate.length,
          session_id: sessionId
        }
      });

    console.log(`Base fragment generated successfully: ${fragment.component_key}`);
    return { fragment: fragment.component_key, success: true, audioPath };

  } catch (error) {
    console.error(`Error generating base fragment ${fragment.component_key}:`, error);
    throw error;
  }
}

async function generateSentimentAudio(supabase: any, options: {
  sentiment: string;
  sessionId: string;
  userId: string;
  userName: string;
  voiceId: string;
  elevenLabsApiKey: string;
}) {
  const { sentiment, sessionId, userId, userName, voiceId, elevenLabsApiKey } = options;
  
  try {
    console.log(`Generating sentiment audio: ${sentiment}`);

    // Buscar contexto do sentimento da tabela sentimentos
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('sentimentos')
      .select('contexto')
      .eq('nome', sentiment)
      .single();

    if (sentimentError) {
      console.error('Erro ao buscar sentimento:', sentimentError);
      // Fallback para contexto genérico
      var textToGenerate = `${sentiment}s que eu senti`;
    } else {
      var textToGenerate = sentimentData.contexto || `${sentiment}s que eu senti`;
    }

    // Gerar áudio via ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: textToGenerate,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioPath = `user-audio-library/${userId}/${sessionId}/sentiment-${sentiment}-${Date.now()}.mp3`;

    // Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio-assembly')
      .upload(audioPath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // Salvar na biblioteca do usuário
    const { error: libraryError } = await supabase
      .from('user_audio_library')
      .insert({
        user_id: userId,
        component_key: `sentiment_${sentiment}`,
        component_type: 'sentiment',
        sentiment_name: sentiment,
        audio_path: audioPath,
        generation_method: 'elevenlabs_tts',
        status: 'completed'
      });

    if (libraryError) {
      throw new Error(`Erro ao salvar na biblioteca: ${libraryError.message}`);
    }

    // Rastrear uso de créditos
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        service: 'elevenlabs',
        operation_type: 'text_to_speech',
        tokens_used: textToGenerate.length,
        cost_usd: 0.30, // Estimativa
        metadata: {
          sentiment,
          voice_id: voiceId,
          text_length: textToGenerate.length,
          session_id: sessionId
        }
      });

    console.log(`Sentiment audio generated successfully: ${sentiment}`);
    return { sentiment, success: true, audioPath };

  } catch (error) {
    console.error(`Error generating sentiment audio ${sentiment}:`, error);
    throw error;
  }
}