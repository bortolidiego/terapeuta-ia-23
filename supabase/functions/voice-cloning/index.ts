import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Voice clone request received');

    if (!elevenlabsApiKey) {
      console.error('CRITICAL: ELEVENLABS_API_KEY is missing from environment variables');
      throw new Error('Server configuration error: Missing ElevenLabs API Key');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    const body = await req.json();
    const { action, audioBase64, voiceName, description, language, voiceId } = body;

    // AÇÃO: EXCLUIR VOZ
    if (action === 'delete_voice') {
      const targetVoiceId = voiceId;
      if (!targetVoiceId) throw new Error('voiceId is required for deletion');

      console.log(`Deleting voice ${targetVoiceId} from ElevenLabs...`);

      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${targetVoiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs Delete Error:', errorText);
        throw new Error(`ElevenLabs API error: ${errorText}`);
      }

      console.log('Voice deleted successfully from ElevenLabs');
      return new Response(JSON.stringify({ success: true, message: 'Voice deleted from ElevenLabs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AÇÃO PADRÃO: CLONAR VOZ (MANTENDO COMPATIBILIDADE)
    if (!audioBase64 || !voiceName) {
      throw new Error('Audio data and voice name are required');
    }

    // Check user credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('elevenlabs_credits, total_spent_elevenlabs')
      .eq('user_id', user.id)
      .single();

    if (creditsError) {
      console.error('Error fetching credits:', creditsError);
      throw new Error('Failed to fetch user credits');
    }

    console.log('User credits:', credits?.elevenlabs_credits);

    if (!credits || credits.elevenlabs_credits < 100) {
      // Create notification about insufficient credits
      await supabase.from('user_notifications').insert({
        user_id: user.id,
        type: 'credits_insufficient',
        title: 'Créditos insuficientes',
        message: 'Você não tem créditos suficientes para clonar sua voz. A clonagem requer 100 créditos. Recarregue seus créditos para continuar.',
        metadata: { required: 100, current: credits?.elevenlabs_credits || 0 }
      });
      throw new Error('Insufficient ElevenLabs credits. Voice cloning requires 100 credits.');
    }

    // Convert base64 to binary
    const binaryAudio = atob(audioBase64);
    const audioBuffer = new Uint8Array(binaryAudio.length);
    for (let i = 0; i < binaryAudio.length; i++) {
      audioBuffer[i] = binaryAudio.charCodeAt(i);
    }

    console.log('Audio processed, size:', audioBuffer.length);

    // Create FormData for ElevenLabs API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('files', audioBlob, 'voice_sample.wav');
    formData.append('name', voiceName);
    // Use provided language or default to Portuguese
    const targetLanguage = language || 'Portuguese';
    const targetAccent = targetLanguage === 'Portuguese' ? 'Brazilian' : 'American';

    // Map full language names to ISO codes (ElevenLabs might prefer these)
    const languageMap: Record<string, string> = {
      'Portuguese': 'pt-BR',
      'English': 'en',
      'Spanish': 'es',
      'German': 'de',
      'Italian': 'it',
      'French': 'fr',
      'Polish': 'pl'
    };

    console.log('Creating voice with language:', targetLanguage, 'accent:', targetAccent);

    formData.append('description', description || `Voice cloned for ${user.email} - ${targetLanguage} (${targetAccent})`);

    // Labels must be a flat JSON object with string keys and values
    const labels = {
      'language': targetLanguage,
      'accent': targetAccent,
      'use_case': 'therapy',
      'descriptive': 'natural speaking voice'
    };
    formData.append('labels', JSON.stringify(labels));

    console.log('Labels being sent:', JSON.stringify(labels));

    console.log('Calling ElevenLabs API...');

    // Call ElevenLabs voice cloning API
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API Error Status:', response.status);
      console.error('ElevenLabs API Error Body:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`ElevenLabs API error: ${errorJson.detail?.message || 'Voice cloning failed'}`);
      } catch (e) {
        throw new Error(`ElevenLabs API error: ${errorText}`);
      }
    }

    const voiceData = await response.json();
    console.log('ElevenLabs success, voice_id:', voiceData.voice_id);

    // Store voice ID temporarily for testing (don't update profile yet)
    const tempVoiceData = {
      voice_id: voiceData.voice_id,
      voice_name: voiceName,
      status: 'testing'
    };

    // Deduct credits and track usage
    const creditCost = 100; // Voice cloning cost
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        elevenlabs_credits: credits.elevenlabs_credits - creditCost,
        total_spent_elevenlabs: (credits.total_spent_elevenlabs || 0) + (creditCost * 0.01)
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      // Don't fail the request if credit update fails, but log it
    }

    // Check if credits are running low and notify user
    const remainingCredits = credits.elevenlabs_credits - creditCost;
    if (remainingCredits < 100) {
      await supabase.from('user_notifications').insert({
        user_id: user.id,
        type: 'credits_low',
        title: 'Créditos baixos',
        message: remainingCredits <= 0
          ? 'Seus créditos ElevenLabs acabaram. Recarregue para continuar clonando vozes ou gerando áudios.'
          : `Seus créditos estão baixos (${remainingCredits} restantes). Considere recarregar para uso contínuo.`,
        metadata: { remaining: remainingCredits }
      });
    }

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: user.id,
      service: 'elevenlabs',
      operation_type: 'voice_clone',
      tokens_used: creditCost,
      cost_usd: creditCost * 0.01,
      metadata: {
        voice_id: voiceData.voice_id,
        voice_name: voiceName,
        audio_size: audioBuffer.length
      }
    });

    // Create notification
    await supabase.from('user_notifications').insert({
      user_id: user.id,
      type: 'voice_clone_ready',
      title: 'Voz clonada com sucesso!',
      message: `Sua voz "${voiceName}" foi clonada e está pronta para uso. Agora você pode gerar sua biblioteca personalizada de áudios.`,
      metadata: { voice_id: voiceData.voice_id, voice_name: voiceName }
    });

    return new Response(JSON.stringify({
      success: true,
      voice_id: voiceData.voice_id,
      voice_name: voiceName,
      credits_remaining: credits.elevenlabs_credits - creditCost,
      status: 'ready_for_testing',
      message: 'Voice cloned successfully - ready for testing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice-cloning function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});