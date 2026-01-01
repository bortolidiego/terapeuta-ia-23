import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STATIC_PHRASES = [
    "Código ALMA, a minha consciência escolhe:",
    "ACABARAM!",
    "que eu senti",
    "que eu recebi",
    "TODOS OS SENTIMENTOS PREJUDICIAIS",
    "Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu gerei",
    "Código ESPÍRITO, a minha consciência escolhe: todas as informações prejudiciais que eu recebi"
];

const COMMON_SENTIMENTS = [
    "RAIVA", "MEDO", "TRISTEZA", "CULPA", "VERGONHA",
    "REJEIÇÃO", "ABANDONO", "INSEGURANÇA", "IMPOTÊNCIA", "FRUSTRAÇÃO"
];

async function hashText(text: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(text.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { userId, voiceId } = await req.json();

        if (!userId || !voiceId) {
            throw new Error('userId and voiceId are required');
        }

        console.log(`Starting pre-generation for user ${userId} with voice ${voiceId}`);

        const allTexts = [...STATIC_PHRASES, ...COMMON_SENTIMENTS];
        const results = { generated: 0, skipped: 0, errors: 0 };

        for (const text of allTexts) {
            const textHash = await hashText(text);

            // Check cache
            const { data: existing } = await supabase
                .from('audio_fragments_cache')
                .select('id')
                .eq('voice_id', voiceId)
                .eq('text_hash', textHash)
                .single();

            if (existing) {
                results.skipped++;
                continue;
            }

            // Generate Audio
            try {
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': elevenlabsApiKey!,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: text,
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
                    console.error(`Failed to generate for "${text}": ${response.statusText}`);
                    results.errors++;
                    continue;
                }

                const audioBuffer = await response.arrayBuffer();

                // Upload to Storage
                const fileName = `${userId}/cache/${textHash}.mp3`;
                const { error: uploadError } = await supabase.storage
                    .from('audio-assembly') // Reusing existing bucket
                    .upload(fileName, audioBuffer, {
                        contentType: 'audio/mpeg',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Save to Cache Table
                await supabase.from('audio_fragments_cache').insert({
                    user_id: userId,
                    voice_id: voiceId,
                    text_content: text,
                    text_hash: textHash,
                    audio_path: fileName
                });

                results.generated++;

                // Rate limiting protection
                await new Promise(r => setTimeout(r, 200));

            } catch (err) {
                console.error(`Error processing "${text}":`, err);
                results.errors++;
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in pre-generate-audio:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
