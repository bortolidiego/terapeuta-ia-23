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

    const { libraryItemId, textContent } = await req.json();

    if (!libraryItemId || !textContent) {
      throw new Error('Library item ID and text content are required');
    }

    // Get library item
    const { data: libraryItem } = await supabase
      .from('user_audio_library')
      .select('*')
      .eq('id', libraryItemId)
      .eq('user_id', user.id)
      .single();

    if (!libraryItem) {
      throw new Error('Library item not found');
    }

    // Get user's cloned voice ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('cloned_voice_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.cloned_voice_id) {
      throw new Error('User voice not cloned yet');
    }

    // Check user credits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('elevenlabs_credits')
      .eq('user_id', user.id)
      .single();

    const charactersCount = textContent.length;
    const creditCost = Math.ceil(charactersCount / 10); // 1 credit per 10 characters

    if (!credits || credits.elevenlabs_credits < creditCost) {
      throw new Error(`Insufficient ElevenLabs credits. Need ${creditCost} credits for ${charactersCount} characters.`);
    }

    // Update status to processing
    await supabase
      .from('user_audio_library')
      .update({ status: 'processing' })
      .eq('id', libraryItemId);

    // Generate audio with ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.cloned_voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: textContent,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      await supabase
        .from('user_audio_library')
        .update({ status: 'failed' })
        .eq('id', libraryItemId);

      const error = await response.json();
      throw new Error(`ElevenLabs API error: ${error.detail?.message || 'Audio generation failed'}`);
    }

    // Get audio buffer
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Upload to Supabase Storage
    const fileName = `${user.id}/${libraryItem.component_key}_${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-assembly')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      await supabase
        .from('user_audio_library')
        .update({ status: 'failed' })
        .eq('id', libraryItemId);
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    // Update library item with audio path
    await supabase
      .from('user_audio_library')
      .update({ 
        audio_path: uploadData.path,
        status: 'completed',
        generation_method: 'ai'
      })
      .eq('id', libraryItemId);

    // Deduct credits and track usage
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
      operation_type: 'audio_generation',
      tokens_used: creditCost,
      cost_usd: creditCost * 0.01,
      metadata: { 
        component_key: libraryItem.component_key,
        character_count: charactersCount,
        audio_path: uploadData.path
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      audio_path: uploadData.path,
      credits_remaining: credits.elevenlabs_credits - creditCost,
      message: 'Audio generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-audio-item function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});