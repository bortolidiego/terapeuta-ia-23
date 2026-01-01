import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

async function hashText(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
    console.log(`[processAudioAssembly] Starting PROTOCOL assembly for job ${jobId}`);

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      await updateJobStatus(supabase, jobId, 'failed', 0, 'Erro: Chave da API ElevenLabs não configurada');
      return;
    }

    if (!instructions.metadata) {
      await updateJobStatus(supabase, jobId, 'failed', 0, 'Erro: Metadados ausentes nas instruções de assembly');
      return;
    }

    await updateJobStatus(supabase, jobId, 'processing', 10, 'Iniciando protocolo...');

    const { data: baseComponents, error: baseError } = await supabase
      .from('audio_components')
      .select('*')
      .eq('is_available', true);

    if (baseError) throw new Error('Failed to fetch base components');

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('cloned_voice_id')
      .eq('user_id', userId)
      .single();

    const voiceId = userProfile?.cloned_voice_id || 'EXAVITQu4vr4xnSDxMaL';
    console.log('[processAudioAssembly] Using voice ID:', voiceId);

    await updateJobStatus(supabase, jobId, 'processing', 20, 'Montando frases do protocolo...');

    const audioSegments = [];
    const assemblySequence = instructions.assemblySequence || [];
    const totalSequences = assemblySequence.length;
    const { metadata } = instructions;

    for (let i = 0; i < totalSequences; i++) {
      const sequence = assemblySequence[i];
      console.log(`[processAudioAssembly] Processing sequence ${i + 1}/${totalSequences}`);

      const sequenceBuffers: ArrayBuffer[] = [];
      let fullPhraseText = '';

      for (const component of sequence.components) {
        let componentText = component;
        const baseComponent = baseComponents.find((base: any) => base.component_key === component);
        if (baseComponent) componentText = baseComponent.text_content;

        componentText = componentText.trim();
        if (!componentText) continue;

        fullPhraseText += componentText + ' ';

        // 1. Check Cache
        const textHash = await hashText(componentText);
        let audioBuffer: ArrayBuffer | null = null;

        const { data: cachedFragment } = await supabase
          .from('audio_fragments_cache')
          .select('audio_path')
          .eq('voice_id', voiceId)
          .eq('text_hash', textHash)
          .single();

        if (cachedFragment) {
          const { data: downloadData } = await supabase.storage
            .from('audio-assembly')
            .download(cachedFragment.audio_path);
          if (downloadData) audioBuffer = await downloadData.arrayBuffer();
        }

        // 2. Generate if missing
        if (!audioBuffer) {
          try {
            const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: componentText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.7,
                  similarity_boost: 0.9,
                  style: 0.2,
                  use_speaker_boost: true
                }
              }),
            });

            if (!ttsResponse.ok) throw new Error(`TTS failed: ${await ttsResponse.text()}`);
            audioBuffer = await ttsResponse.arrayBuffer();

            const cacheFileName = `${userId}/cache/${textHash}.mp3`;
            await supabase.storage
              .from('audio-assembly')
              .upload(cacheFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

            await supabase.from('audio_fragments_cache').insert({
              user_id: userId,
              voice_id: voiceId,
              text_content: componentText,
              text_hash: textHash,
              audio_path: cacheFileName
            });
          } catch (err) {
            console.error(`Error generating component "${componentText}":`, err);
            throw err;
          }
        }

        if (audioBuffer) sequenceBuffers.push(audioBuffer);
      }

      // Concatenate phrase
      const phraseBuffer = await concatenateAudioBuffers(sequenceBuffers);
      const phraseUint8Array = new Uint8Array(phraseBuffer);

      const segmentFileName = `protocol_segment_${i + 1}_${Date.now()}.mp3`;
      const segmentPath = `${userId}/assembly-segments/${jobId}/${segmentFileName}`;

      await supabase.storage
        .from('audio-assembly')
        .upload(segmentPath, phraseUint8Array, { contentType: 'audio/mpeg', upsert: true });

      audioSegments.push({
        path: segmentPath,
        buffer: phraseUint8Array,
        text: fullPhraseText.trim(),
        sequenceId: sequence.sequenceId,
        type: i < metadata.sentimentCount ? 'individual_sentiment' : 'final_phrase'
      });

      const progress = 20 + Math.floor((i + 1) / totalSequences * 60);
      await updateJobStatus(supabase, jobId, 'processing', progress, `Frase ${i + 1} de ${totalSequences} processada`);
    }

    await updateJobStatus(supabase, jobId, 'processing', 85, 'Concatenando protocolo final...');

    const finalAudioBuffer = await concatenateAudioBuffers(audioSegments.map(seg => seg.buffer));

    const finalFileName = `protocol_assembly_${jobId}_${Date.now()}.mp3`;
    const finalPath = `${userId}/assembly-results/${finalFileName}`;

    await supabase.storage
      .from('audio-assembly')
      .upload(finalPath, finalAudioBuffer, { contentType: 'audio/mpeg', upsert: true });

    await updateJobStatus(supabase, jobId, 'processing', 95, 'Finalizando protocolo...');

    await supabase
      .from('assembly_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        result_audio_path: finalPath,
        total_duration_seconds: Math.floor(audioSegments.length * 8),
        total_file_size_bytes: finalAudioBuffer.byteLength
      })
      .eq('id', jobId);

    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'protocol_assembly_completed',
        title: 'Protocolo Concluído',
        message: 'Seu protocolo de autocura está pronto.',
        metadata: { job_id: jobId, audio_path: finalPath }
      });

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await supabase
      .from('assembly_jobs')
      .update({ status: 'failed', error_message: error.message, completed_at: new Date().toISOString() })
      .eq('id', jobId);
    throw error;
  }
}

async function updateJobStatus(supabase: any, jobId: string, status: string, progress: number, message?: string) {
  const updateData: any = { status, progress_percentage: progress, updated_at: new Date().toISOString() };
  if (status === 'processing' && !updateData.started_at) updateData.started_at = new Date().toISOString();
  await supabase.from('assembly_jobs').update(updateData).eq('id', jobId);
}

async function concatenateAudioBuffers(audioBuffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (audioBuffers.length === 0) return new ArrayBuffer(0);
  if (audioBuffers.length === 1) return audioBuffers[0];

  const processedBuffers: Uint8Array[] = [];
  let totalAudioSize = 0;
  let firstId3Header: Uint8Array | null = null;

  for (let i = 0; i < audioBuffers.length; i++) {
    const buffer = new Uint8Array(audioBuffers[i]);
    const processed = extractMp3AudioData(buffer, i === 0);
    if (i === 0 && processed.id3Header) firstId3Header = processed.id3Header;
    processedBuffers.push(processed.audioData);
    totalAudioSize += processed.audioData.length;
  }

  const headerSize = firstId3Header ? firstId3Header.length : 0;
  const finalBuffer = new Uint8Array(headerSize + totalAudioSize);
  let offset = 0;

  if (firstId3Header) {
    finalBuffer.set(firstId3Header, offset);
    offset += firstId3Header.length;
  }

  for (const audioData of processedBuffers) {
    finalBuffer.set(audioData, offset);
    offset += audioData.length;
  }

  return finalBuffer.buffer;
}

function extractMp3AudioData(buffer: Uint8Array, keepId3: boolean): { audioData: Uint8Array; id3Header?: Uint8Array } {
  let audioStart = 0;
  let id3Header: Uint8Array | undefined;

  if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size = ((buffer[6] & 0x7F) << 21) | ((buffer[7] & 0x7F) << 14) | ((buffer[8] & 0x7F) << 7) | (buffer[9] & 0x7F);
    const id3Size = 10 + size;
    if (keepId3 && id3Size <= buffer.length) id3Header = buffer.slice(0, id3Size);
    audioStart = Math.min(id3Size, buffer.length);
  }

  while (audioStart < buffer.length - 1) {
    if (buffer[audioStart] === 0xFF && (buffer[audioStart + 1] & 0xE0) === 0xE0) break;
    audioStart++;
  }

  let audioEnd = buffer.length;
  if (buffer.length >= 128) {
    const tagStart = buffer.length - 128;
    if (buffer[tagStart] === 0x54 && buffer[tagStart + 1] === 0x41 && buffer[tagStart + 2] === 0x47) audioEnd = tagStart;
  }

  return { audioData: buffer.slice(audioStart, audioEnd), id3Header };
}

function validateMp3Structure(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  for (let i = 0; i < Math.min(buffer.length - 1, 200); i++) {
    if (buffer[i] === 0xFF && (buffer[i + 1] & 0xE0) === 0xE0) return true;
  }
  return false;
}