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

// FASE 3: Main audio assembly processing function - Frases Completas
async function processAudioAssembly(supabase: any, job: any) {
  const jobId = job.id;
  const instructions = job.assembly_instructions;
  const userId = job.user_id;
  
  try {
    console.log(`[processAudioAssembly] Starting PROTOCOL assembly for job ${jobId}`);
    console.log(`[processAudioAssembly] Assembly instructions:`, JSON.stringify(instructions, null, 2));
    
    // Validar se a API key do ElevenLabs está configurada
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      console.error(`[processAudioAssembly] ElevenLabs API key not configured`);
      await updateJobStatus(supabase, jobId, 'failed', 0, 'Erro: Chave da API ElevenLabs não configurada');
      return;
    }
    
    // Validar se os dados necessários estão presentes
    if (!instructions.metadata) {
      console.error(`[processAudioAssembly] Missing metadata in assembly instructions`);
      await updateJobStatus(supabase, jobId, 'failed', 0, 'Erro: Metadados ausentes nas instruções de assembly');
      return;
    }
    
    // Atualizar status para processing
    await updateJobStatus(supabase, jobId, 'processing', 10, 'Iniciando protocolo...');

    // Get user's audio library for personalized components
    const { data: userLibrary, error: libraryError } = await supabase
      .from('user_audio_library')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (libraryError) {
      console.error('[processAudioAssembly] Error fetching user library:', libraryError);
    }

    // Get base audio components
    const { data: baseComponents, error: baseError } = await supabase
      .from('audio_components')
      .select('*')
      .eq('is_available', true);

    if (baseError) {
      console.error('[processAudioAssembly] Error fetching base components:', baseError);
      throw new Error('Failed to fetch base components');
    }

    // Get user profile for voice settings
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('cloned_voice_id')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.warn('[processAudioAssembly] Could not fetch user profile:', profileError);
    }

    const voiceId = userProfile?.cloned_voice_id || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    console.log('[processAudioAssembly] Using voice ID:', voiceId);

    await updateJobStatus(supabase, jobId, 'processing', 20, 'Montando frases do protocolo...');

    const audioSegments = [];
    const assemblySequence = instructions.assemblySequence || [];
    const totalSequences = assemblySequence.length;

    // Validação do protocolo
    const { metadata } = instructions;
    const protocolType = metadata?.protocolType || 'evento_traumatico_especifico';
    
    if (protocolType !== 'evento_traumatico_especifico') {
      throw new Error(`Protocolo não suportado: ${protocolType}`);
    }

    console.log(`[processAudioAssembly] Processing protocol with ${metadata.sentimentCount} sentiments + ${metadata.protocolStructure?.finalPhrases || 4} final phrases`);

    for (let i = 0; i < totalSequences; i++) {
      const sequence = assemblySequence[i];
      console.log(`[processAudioAssembly] Processing sequence ${i + 1}/${totalSequences}:`, sequence);

      // Build the complete phrase for this sequence
      let phraseText = '';

      for (const component of sequence.components) {
        // Check if it's a base component first
        const baseComponent = baseComponents.find(base => base.component_key === component);

        if (baseComponent) {
          phraseText += baseComponent.text_content + ' ';
        } else {
          // Treat as literal text (sentiment or event)
          phraseText += component + ' ';
        }
      }

      // Clean up the phrase text
      phraseText = phraseText.trim().replace(/\s+/g, ' ');

      // Ensure it ends with exclamation for protocol emphasis
      if (!phraseText.endsWith('!') && !phraseText.endsWith('.')) {
        phraseText += '!';
      }

      console.log(`[processAudioAssembly] Generated phrase ${i + 1}: "${phraseText}"`);

      // Generate audio using ElevenLabs TTS with protocol-appropriate settings
      try {
        const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
        const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: phraseText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.7,          // Mais estável para protocolo
              similarity_boost: 0.9,   // Maior similaridade
              style: 0.2,              // Pouco estilo para clareza
              use_speaker_boost: true
            }
          }),
        });

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          console.error(`[processAudioAssembly] TTS Error for sequence ${i + 1}:`, errorText);
          console.error(`[processAudioAssembly] Voice ID used:`, voiceId);
          console.error(`[processAudioAssembly] API Key configured:`, elevenLabsApiKey ? 'Yes' : 'No');
          throw new Error(`TTS failed: ${errorText}`);
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioUint8Array = new Uint8Array(audioBuffer);

        // Upload audio segment to storage
        const segmentFileName = `protocol_segment_${i + 1}_${Date.now()}.mp3`;
        const segmentPath = `${userId}/assembly-segments/${jobId}/${segmentFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('audio-assembly')
          .upload(segmentPath, audioUint8Array, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (uploadError) {
          console.error(`[processAudioAssembly] Upload error for segment ${i + 1}:`, uploadError);
          throw new Error(`Failed to upload segment: ${uploadError.message}`);
        }

        audioSegments.push({
          path: segmentPath,
          buffer: audioUint8Array,
          text: phraseText,
          sequenceId: sequence.sequenceId,
          type: i < metadata.sentimentCount ? 'individual_sentiment' : 'final_phrase'
        });

        // Update progress
        const progress = 20 + Math.floor((i + 1) / totalSequences * 60);
        await updateJobStatus(supabase, jobId, 'processing', progress, 
          `Frase ${i + 1} de ${totalSequences} processada`);

      } catch (ttsError) {
        console.error(`[processAudioAssembly] TTS Error for sequence ${i + 1}:`, ttsError);
        throw new Error(`Failed to generate audio for sequence ${i + 1}: ${ttsError.message}`);
      }
    }

    await updateJobStatus(supabase, jobId, 'processing', 85, 'Concatenando protocolo final...');

    // Concatenate all audio segments with proper spacing for protocol
    const finalAudioBuffer = concatenateAudioBuffers(audioSegments.map(seg => seg.buffer));
    
    // Validar integridade do arquivo final
    if (!finalAudioBuffer || finalAudioBuffer.byteLength === 0) {
      console.error('[processAudioAssembly] Arquivo final vazio ou inválido');
      throw new Error('Arquivo de áudio final está vazio');
    }
    
    if (finalAudioBuffer.byteLength < 1000) {
      console.error('[processAudioAssembly] Arquivo final muito pequeno:', finalAudioBuffer.byteLength);
      throw new Error('Arquivo de áudio final muito pequeno, provavelmente corrompido');
    }
    
    console.log(`[processAudioAssembly] Arquivo final gerado com ${finalAudioBuffer.byteLength} bytes`);

    // Upload final audio file
    const finalFileName = `protocol_assembly_${jobId}_${Date.now()}.mp3`;
    const finalPath = `${userId}/assembly-results/${finalFileName}`;

    const { error: finalUploadError } = await supabase.storage
      .from('audio-assembly')
      .upload(finalPath, finalAudioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: 'no-cache'
      });

    if (finalUploadError) {
      console.error('[processAudioAssembly] Final upload error:', finalUploadError);
      throw new Error(`Failed to upload final audio: ${finalUploadError.message}`);
    }
    
    // Verificar se o arquivo foi carregado corretamente
    const { data: uploadedFile, error: verifyError } = await supabase.storage
      .from('audio-assembly')
      .list(finalPath.split('/').slice(0, -1).join('/'));
      
    if (verifyError || !uploadedFile?.some(file => file.name === finalFileName)) {
      console.error('[processAudioAssembly] Falha na verificação do upload');
      throw new Error('Arquivo não foi carregado corretamente');
    }
    
    console.log(`[processAudioAssembly] Arquivo verificado com sucesso: ${finalPath}`);

    await updateJobStatus(supabase, jobId, 'processing', 95, 'Finalizando protocolo...');

    // Update job with final results
    const { error: updateError } = await supabase
      .from('assembly_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        result_audio_path: finalPath,
        total_duration_seconds: Math.floor(audioSegments.length * 8), // Estimated
        total_file_size_bytes: finalAudioBuffer.byteLength
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[processAudioAssembly] Error updating job completion:', updateError);
    }

    // Create detailed user notification
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'protocol_assembly_completed',
        title: 'Protocolo de Evento Traumático Concluído',
        message: `Seu protocolo foi gerado com ${metadata.sentimentCount} sentimentos individuais e 4 frases finais.`,
        metadata: {
          job_id: jobId,
          audio_path: finalPath,
          protocol_type: metadata.protocolType,
          sentiment_count: metadata.sentimentCount,
          total_phrases: audioSegments.length,
          structure: metadata.protocolStructure
        }
      });

    console.log('[processAudioAssembly] Protocol assembly completed successfully for job:', jobId);
    console.log(`[processAudioAssembly] Final structure: ${metadata.sentimentCount} individual + 4 final = ${audioSegments.length} total phrases`);

  } catch (error) {
    console.error(`[processAudioAssembly] Error processing job ${jobId}:`, error);
    
    await supabase
      .from('assembly_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Create error notification
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'protocol_assembly_failed',
        title: 'Erro no Protocolo de Evento Traumático',
        message: `Falha ao processar o protocolo: ${error.message}`,
        metadata: {
          job_id: jobId,
          error: error.message
        }
      });
    
    throw error;
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

// FASE 1: Função para concatenação real de áudios
async function concatenateAudioBuffers(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  // Implementação simplificada de concatenação
  // Em produção, seria ideal usar FFmpeg via WebAssembly
  
  if (buffers.length === 0) return new ArrayBuffer(0);
  if (buffers.length === 1) return buffers[0];
  
  // Para MP3, vamos fazer uma concatenação básica
  // Nota: Esta é uma implementação simplificada
  let totalSize = 0;
  for (const buffer of buffers) {
    totalSize += buffer.byteLength;
  }
  
  const result = new Uint8Array(totalSize);
  let offset = 0;
  
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  
  return result.buffer;
}