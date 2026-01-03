import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Map language names to ISO 639-1 codes for ElevenLabs
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'Portuguese': 'pt',
  'English': 'en',
  'Spanish': 'es',
  'German': 'de',
  'Italian': 'it',
  'French': 'fr',
  'Polish': 'pl',
  'Dutch': 'nl',
  'Arabic': 'ar',
  'Hindi': 'hi',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Russian': 'ru',
  'Turkish': 'tr',
  'Indonesian': 'id',
  'Chinese': 'zh'
};

// Longer inspirational text (~30 second read time for voice test) - Portuguese
const INSPIRATIONAL_TEXT_PT = `Olá, esta é a sua voz clonada. Respire fundo e permita-se sentir a paz deste momento.

Você é um ser de luz infinita, conectado ao campo unificado de energia que permeia o universo. Cada célula do seu corpo vibra em harmonia com a frequência da cura e do amor.

Lembre-se: você tem o poder de transformar sua realidade através da sua intenção e consciência. A jornada de autocura começa agora, neste exato instante de presença plena.

Sinta a gratidão fluir pelo seu coração e irradiar para todo o seu ser. Você é amado, você é completo, você é capaz.`;

// English version
const INSPIRATIONAL_TEXT_EN = `Hello, this is your cloned voice. Take a deep breath and allow yourself to feel the peace of this moment.

You are a being of infinite light, connected to the unified field of energy that permeates the universe. Every cell in your body vibrates in harmony with the frequency of healing and love.

Remember: you have the power to transform your reality through your intention and consciousness. The journey of self-healing begins now, in this very instant of full presence.

Feel gratitude flow through your heart and radiate throughout your entire being. You are loved, you are complete, you are capable.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Voice clone TEST request received');

    if (!elevenlabsApiKey) {
      console.error('CRITICAL: ELEVENLABS_API_KEY is missing from environment variables');
      throw new Error('Server configuration error: Missing ElevenLabs API Key');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { voiceId, testPhrase, language } = await req.json();

    if (!voiceId) {
      throw new Error('Voice ID is required');
    }

    // Get language code from language name, default to Portuguese
    const selectedLanguage = language || 'Portuguese';
    const languageCode = LANGUAGE_CODE_MAP[selectedLanguage] || 'pt';

    // Use provided test phrase or appropriate inspirational text based on language
    let textToSpeak = testPhrase;
    if (!textToSpeak) {
      textToSpeak = selectedLanguage === 'English' ? INSPIRATIONAL_TEXT_EN : INSPIRATIONAL_TEXT_PT;
    }

    console.log('Generating voice test with ID:', voiceId, 'language_code:', languageCode);

    // Using eleven_multilingual_v2 with language_code for correct pronunciation
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: textToSpeak,
        model_id: 'eleven_multilingual_v2',
        language_code: languageCode, // Ensures correct pronunciation
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.9,
          style: 0.1,
          use_speaker_boost: true
        },
        output_format: 'mp3_44100_128'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS Error:', errorText);
      let errorMessage = 'Voice test failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorJson.detail?.status || errorMessage;
      } catch { }
      throw new Error(`ElevenLabs API error: ${errorMessage}`);
    }

    console.log('ElevenLabs API response OK, converting to base64...');

    // Convert audio to base64 using Deno's built-in encoder (handles large files properly)
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = base64Encode(new Uint8Array(audioBuffer));

    console.log('Voice test generated successfully, audio size:', audioBuffer.byteLength, 'bytes');

    return new Response(JSON.stringify({
      success: true,
      audioBase64,
      testPhrase: textToSpeak,
      voiceId,
      language: selectedLanguage,
      languageCode,
      model: 'eleven_multilingual_v2',
      message: 'Voice test generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice-clone-test function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});