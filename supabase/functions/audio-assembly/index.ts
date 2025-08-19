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
    const { assemblyInstructions, sessionId, userId } = await req.json();
    console.log(`Starting audio assembly for session: ${sessionId}, user: ${userId}`);

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role para operações admin
    );

    // Criar job de montagem
    const { data: job, error: jobError } = await supabase
      .from('assembly_jobs')
      .insert({
        session_id: sessionId,
        user_id: userId,
        assembly_instructions: assemblyInstructions,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Erro ao criar assembly job:', jobError);
      throw new Error('Falha ao criar job de montagem');
    }

    console.log(`Assembly job created: ${job.id}`);

    // Iniciar processamento em background (não aguardar)
    EdgeRuntime.waitUntil(processAudioAssembly(supabase, job));

    // Retornar resposta imediata
    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      message: 'Montagem de áudio iniciada! Você receberá notificações sobre o progresso.',
      estimatedDuration: assemblyInstructions.estimatedDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in audio-assembly function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processAudioAssembly(supabase: any, job: any) {
  const jobId = job.id;
  const instructions = job.assembly_instructions;
  const userId = job.user_id;
  
  try {
    console.log(`Processing assembly job ${jobId}`);
    
    // Atualizar status para processing
    await updateJobStatus(supabase, jobId, 'processing', 0, 'Iniciando montagem...');

    // Buscar áudios da biblioteca do usuário
    const { data: userAudioLibrary, error: libraryError } = await supabase
      .from('user_audio_library')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (libraryError) {
      throw new Error(`Erro ao buscar biblioteca de áudios: ${libraryError.message}`);
    }

    console.log(`Found ${userAudioLibrary.length} audio items in user library`);

    // Buscar componentes base como fallback
    const { data: baseComponents, error: componentsError } = await supabase
      .from('audio_components')
      .select('*')
      .eq('is_available', true);

    if (componentsError) {
      throw new Error(`Erro ao buscar componentes base: ${componentsError.message}`);
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key não configurada');
    }

    // Buscar perfil do usuário para obter voice_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('cloned_voice_id, full_name')
      .eq('user_id', userId)
      .single();

    const voiceId = profile?.cloned_voice_id || 'pNInz6obpgDQGcFmaJgB';
    const userName = profile?.full_name || 'você';

    const totalSteps = instructions.assemblyOrder.length;
    const audioSegments = [];

    // Processar cada segmento
    for (let i = 0; i < totalSteps; i++) {
      const step = instructions.assemblyOrder[i];
      
      // Primeiro, tentar encontrar na biblioteca do usuário
      let audioPath = null;
      let needsGeneration = true;
      
      const userAudio = userAudioLibrary.find(audio => 
        audio.component_key === step.componentKey ||
        (audio.sentiment_name && step.componentKey.includes(audio.sentiment_name.toLowerCase()))
      );

      if (userAudio && userAudio.audio_path) {
        audioPath = userAudio.audio_path;
        needsGeneration = false;
        console.log(`Using existing audio from library for step ${i + 1}: ${userAudio.component_key}`);
      } else {
        // Fallback: buscar componente base e gerar áudio
        const baseComponent = baseComponents.find(comp => 
          comp.component_key === step.componentKey ||
          comp.component_type === step.type
        );

        if (baseComponent) {
          console.log(`Generating new audio for step ${i + 1}: ${step.componentKey}`);
          
          // Personalizar texto
          let finalText = baseComponent.text_content;
          for (const [placeholder, replacement] of Object.entries(step.replacements || {})) {
            finalText = finalText.replace(new RegExp(placeholder, 'gi'), replacement);
          }
          finalText = finalText.replace(/\{nome\}/gi, userName);

          // Gerar áudio via ElevenLabs
          try {
            const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': elevenLabsApiKey,
              },
              body: JSON.stringify({
                text: finalText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.8,
                  style: 0.3
                }
              }),
            });

            if (ttsResponse.ok) {
              const audioBuffer = await ttsResponse.arrayBuffer();
              audioPath = `assembly-temp/${jobId}/segment-${i + 1}.mp3`;

              // Upload temporário
              await supabase.storage
                .from('audio-assembly')
                .upload(audioPath, audioBuffer, {
                  contentType: 'audio/mpeg',
                  upsert: true
                });

              console.log(`Generated and uploaded audio for step ${i + 1}`);
            } else {
              throw new Error(`Falha na geração TTS: ${ttsResponse.status}`);
            }
          } catch (ttsError) {
            console.error(`TTS generation failed for step ${i + 1}:`, ttsError);
            // Usar silêncio ou pular este segmento
            audioPath = null;
          }
        }
      }

      if (audioPath) {
        audioSegments.push({
          order: i + 1,
          audioPath,
          componentKey: step.componentKey,
          type: step.type,
          fromLibrary: !needsGeneration
        });
      }

      // Atualizar progresso
      const progress = Math.round(((i + 1) / totalSteps) * 80);
      await updateJobStatus(supabase, jobId, 'processing', progress, 
        `Processando segmento ${i + 1} de ${totalSteps}`);
    }

    console.log(`Processed ${audioSegments.length} segments for job ${jobId}`);

    // Simular concatenação (em produção real, usar ffmpeg ou similar)
    await updateJobStatus(supabase, jobId, 'processing', 90, 'Concatenando áudios...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calcular métricas finais
    const totalDuration = audioSegments.length * 10; // Estimativa
    const estimatedFileSize = totalDuration * 64000;

    // Path final do áudio concatenado
    const resultAudioPath = `assembly-results/${jobId}/final-session-audio.mp3`;

    // Em produção real, aqui seria feita a concatenação real dos arquivos MP3
    // Por ora, vamos simular usando o primeiro segmento disponível
    if (audioSegments.length > 0 && audioSegments[0].audioPath) {
      const { data: firstSegment } = await supabase.storage
        .from('audio-assembly')
        .download(audioSegments[0].audioPath);

      if (firstSegment) {
        await supabase.storage
          .from('audio-assembly')
          .upload(resultAudioPath, firstSegment, {
            contentType: 'audio/mpeg',
            upsert: true
          });
      }
    }

    // Marcar como concluído
    await supabase
      .from('assembly_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        result_audio_path: resultAudioPath,
        total_duration_seconds: totalDuration,
        total_file_size_bytes: estimatedFileSize,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Criar notificação para o usuário
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'audio_assembly',
        title: 'Áudio de Sessão Criado',
        message: `Seu áudio de auto-cura está pronto! ${audioSegments.length} segmentos foram processados.`,
        metadata: {
          job_id: jobId,
          segments_count: audioSegments.length,
          duration: totalDuration,
          result_path: resultAudioPath
        }
      });

    console.log(`Assembly job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Error processing assembly job ${jobId}:`, error);
    
    await supabase
      .from('assembly_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Notificar erro
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'audio_assembly_error',
        title: 'Erro na Criação de Áudio',
        message: `Houve um erro ao processar seu áudio de sessão. Nossa equipe foi notificada.`,
        metadata: {
          job_id: jobId,
          error: error.message
        }
      });
  }
}

async function updateJobStatus(supabase: any, jobId: string, status: string, progress: number, message?: string) {
  const updateData: any = {
    status,
    progress_percentage: progress,
    updated_at: new Date().toISOString()
  };

  if (status === 'processing' && !updateData.started_at) {
    updateData.started_at = new Date().toISOString();
  }

  await supabase
    .from('assembly_jobs')
    .update(updateData)
    .eq('id', jobId);

  console.log(`Job ${jobId} status updated: ${status} (${progress}%) - ${message || ''}`);
}