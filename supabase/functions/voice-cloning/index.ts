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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from authorization header
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { audioBase64, voiceName, description } = await req.json();

    if (!audioBase64 || !voiceName) {
      throw new Error('Audio data and voice name are required');
    }

    // Check user credits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('elevenlabs_credits')
      .eq('user_id', user.id)
      .single();

    if (!credits || credits.elevenlabs_credits < 100) {
      throw new Error('Insufficient ElevenLabs credits. Voice cloning requires 100 credits.');
    }

    // Convert base64 to binary
    const binaryAudio = atob(audioBase64);
    const audioBuffer = new Uint8Array(binaryAudio.length);
    for (let i = 0; i < binaryAudio.length; i++) {
      audioBuffer[i] = binaryAudio.charCodeAt(i);
    }

    // Create FormData for ElevenLabs API with optimized settings
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('files', audioBlob, 'voice_sample.wav');
    formData.append('name', voiceName);
    formData.append('description', description || `Voice cloned for ${user.email} - Portuguese Brazilian`);
    formData.append('labels', JSON.stringify({
      'language': 'Portuguese',
      'accent': 'Brazilian',
      'gender': 'auto-detect',
      'age': 'adult',
      'quality': 'high_fidelity'
    }));

    // Call ElevenLabs voice cloning API with optimized settings
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey!,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ElevenLabs API error: ${error.detail?.message || 'Voice cloning failed'}`);
    }

    const voiceData = await response.json();
    
    // Store voice ID temporarily for testing (don't update profile yet)
    const tempVoiceData = {
      voice_id: voiceData.voice_id,
      voice_name: voiceName,
      status: 'testing'
    };

    // Deduct credits and track usage
    const creditCost = 100; // Voice cloning cost
    await supabase
      .from('user_credits')
      .update({ 
        elevenlabs_credits: credits.elevenlabs_credits - creditCost,
        total_spent_elevenlabs: (credits.total_spent_elevenlabs || 0) + (creditCost * 0.01)
      })
      .eq('user_id', user.id);

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});