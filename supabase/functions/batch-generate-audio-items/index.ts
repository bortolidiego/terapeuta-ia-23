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
    const { sessionId, sentiments, userId } = await req.json();
    console.log(`Starting batch audio generation for session: ${sessionId}, user: ${userId}`);

    if (!sessionId || !sentiments || !Array.isArray(sentiments) || sentiments.length === 0) {
      throw new Error('Session ID e lista de sentimentos são obrigatórios');
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

    console.log(`Generating ${sentiments.length} audio items for user: ${userName}, voice: ${voiceId}`);

    // Buscar fragmentos base para protocolo específico
    const { data: baseFragments, error: fragmentsError } = await supabase
      .from('audio_components')
      .select('*')
      .eq('is_available', true)
      .eq('protocol_type', 'evento_traumatico_especifico')
      .eq('component_type', 'base_word');

    if (fragmentsError) {
      throw new Error(`Erro ao buscar fragmentos: ${fragmentsError.message}`);
    }

    console.log(`Found ${baseFragments.length} available base fragments`);

    // Gerar áudios para fragmentos base + sentimentos
    const baseFragmentPromises = baseFragments.map(async (fragment: any) => {
      return generateBaseFragment(supabase, {
        fragment,
        sessionId,
        userId,
        userName,
        voiceId,
        elevenLabsApiKey
      });
    });

    const sentimentPromises = sentiments.map(async (sentiment: string) => {
      return generateSentimentAudio(supabase, {
        sentiment,
        sessionId,
        userId,
        userName,
        voiceId,
        elevenLabsApiKey
      });
    });

    const allPromises = [...baseFragmentPromises, ...sentimentPromises];

    // Executar todas as gerações em paralelo (máximo 3 simultaneas para não sobrecarregar)
    const batchSize = 3;
    const results = [];
    
    for (let i = 0; i < allPromises.length; i += batchSize) {
      const batch = allPromises.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
      
      // Pequena pausa entre batches
      if (i + batchSize < allPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Processar resultados
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`Batch generation completed: ${successful.length} successful, ${failed.length} failed`);

    // Criar notificação para o usuário
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'audio_generation',
        title: 'Áudios Gerados',
        message: `${successful.length} fragmentos de áudio foram criados com sucesso. ${failed.length > 0 ? `${failed.length} falharam.` : ''}`,
        metadata: {
          session_id: sessionId,
          successful_count: successful.length,
          failed_count: failed.length,
          total_fragments: baseFragments.length + sentiments.length,
          sentiments: sentiments
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: `Geração em lote concluída`,
      results: {
        total: baseFragments.length + sentiments.length,
        successful: successful.length,
        failed: failed.length,
        fragments_generated: baseFragments.length,
        sentiments_generated: sentiments.length
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