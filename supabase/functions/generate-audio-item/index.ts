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

// Context suffix for Portuguese pronunciation
const CONTEXT_SUFFIX = " que eu senti";

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

    // Determine if this is a sentiment (needs context for Portuguese pronunciation)
    const isSentiment = libraryItem.component_type === 'sentiment';
    const displayText = textContent; // Original text (e.g., "Ansiedades")
    const fullText = isSentiment ? `${textContent}. ${CONTEXT_SUFFIX}` : textContent; // Added dot to slow down AI cadence

    const charactersCount = fullText.length;
    const creditCost = Math.ceil(charactersCount / 10); // 1 credit per 10 characters

    if (!credits || credits.elevenlabs_credits < creditCost) {
      throw new Error(`Insufficient ElevenLabs credits. Need ${creditCost} credits for ${charactersCount} characters.`);
    }

    // Update status to processing
    await supabase
      .from('user_audio_library')
      .update({ status: 'processing' })
      .eq('id', libraryItemId);

    console.log(`Generating audio for: "${fullText}" (display: "${displayText}") with voice ${profile.cloned_voice_id}`);

    // Generate audio with ElevenLabs using timestamps endpoint for sentiments
    let audioBuffer: ArrayBuffer;
    let trimEndTime: number | null = null;

    if (isSentiment) {
      // Use timestamps endpoint to get word-level timing
      const timestampResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${profile.cloned_voice_id}/with-timestamps`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenlabsApiKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: fullText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.6, // Slightly lower for more natural/emotional pace
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
              speed: 0.85 // SLOWER: 0.7 to 1.2 range
            }
          }),
        }
      );

      if (!timestampResponse.ok) {
        await supabase
          .from('user_audio_library')
          .update({ status: 'failed' })
          .eq('id', libraryItemId);

        const error = await timestampResponse.json();
        throw new Error(`ElevenLabs API error: ${error.detail?.message || 'Audio generation failed'}`);
      }

      const timestampData = await timestampResponse.json();

      // Get audio from base64
      audioBuffer = Uint8Array.from(atob(timestampData.audio_base64), c => c.charCodeAt(0)).buffer;

      // Log the full alignment data for debugging
      console.log('Alignment data:', JSON.stringify(timestampData.alignment, null, 2));

      // Find the end time of the first word using WORD-level timestamps (more precise)
      if (timestampData.alignment) {
        const alignment = timestampData.alignment;

        if ((alignment as any).words && (alignment as any).word_end_times_seconds) {
          const firstWordEndTime = (alignment as any).word_end_times_seconds[0];
          if (firstWordEndTime !== undefined) {
            // Add a small buffer (30ms) to ensure the word decays naturally
            trimEndTime = Math.round((firstWordEndTime + 0.03) * 1000) / 1000;
            console.log(`Word-level trim: "${(alignment as any).words[0]}" ends at ${firstWordEndTime}s, trimming at ${trimEndTime}s`);
          }
        }
        else if ((alignment as any).characters && (alignment as any).character_end_times_seconds) {
          const charEndTimes = (alignment as any).character_end_times_seconds;
          const displayTextLength = displayText.length;

          // Use the end time of the character AFTER the word (the dot or space at displayTextLength)
          if (displayTextLength > 0 && charEndTimes.length > displayTextLength) {
            const boundaryCharTime = charEndTimes[displayTextLength];
            trimEndTime = Math.round((boundaryCharTime + 0.02) * 1000) / 1000;
            console.log(`Character-level trim (at boundary): index ${displayTextLength} at ${boundaryCharTime}s, final trim: ${trimEndTime}s`);
          } else if (displayTextLength > 0 && charEndTimes.length >= displayTextLength) {
            const lastCharTime = charEndTimes[displayTextLength - 1];
            trimEndTime = Math.round((lastCharTime + 0.05) * 1000) / 1000;
            console.log(`Character-level fallback: index ${displayTextLength - 1} at ${lastCharTime}s, final trim: ${trimEndTime}s`);
          }
        }
      }
    } else {
      // For non-sentiments, use regular endpoint
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.cloned_voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fullText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
            speed: 0.85
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

      audioBuffer = await response.arrayBuffer();
    }

    // Upload to Supabase Storage with standardized path
    const sanitizedKey = libraryItem.component_key
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9_]/g, '_')  // Replace special chars
      .toLowerCase();

    const fileName = `user-audio-library/${user.id}/${Date.now()}/${sanitizedKey}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-library')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      await supabase
        .from('user_audio_library')
        .update({ status: 'failed' })
        .eq('id', libraryItemId);
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    // Update library item with audio path and trim metadata
    console.log(`Updating library item ${libraryItemId} with path: ${uploadData.path}, trimEndTime: ${trimEndTime}`);
    const { error: updateError } = await supabase
      .from('user_audio_library')
      .update({
        audio_path: uploadData.path,
        status: 'completed',
        generation_method: 'ai',
        trim_end_time: trimEndTime,
        full_text: fullText,
        display_text: displayText
      })
      .eq('id', libraryItemId);

    if (updateError) {
      console.error('Error updating library item:', updateError);
      throw new Error(`Failed to update library item: ${updateError.message}`);
    }

    console.log(`Audio generated successfully for item ${libraryItemId}`);

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
        audio_path: uploadData.path,
        trim_end_time: trimEndTime,
        is_sentiment: isSentiment
      }
    });

    return new Response(JSON.stringify({
      success: true,
      audio_path: uploadData.path,
      trim_end_time: trimEndTime,
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