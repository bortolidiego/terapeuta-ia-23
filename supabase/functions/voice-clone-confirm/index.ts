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

    const { voiceId, voiceName, action } = await req.json();

    if (!voiceId || !action) {
      throw new Error('Voice ID and action are required');
    }

    if (action === 'confirm') {
      // Save the cloned voice to user profile
      await supabase
        .from('user_profiles')
        .update({ 
          cloned_voice_id: voiceId,
          voice_library_status: 'voice_cloned'
        })
        .eq('user_id', user.id);

      // Create success notification
      await supabase.from('user_notifications').insert({
        user_id: user.id,
        type: 'voice_clone_confirmed',
        title: 'Voz clonada confirmada!',
        message: `Sua voz "${voiceName}" foi confirmada e salva. Agora você pode gerar sua biblioteca personalizada de áudios.`,
        metadata: { voice_id: voiceId, voice_name: voiceName }
      });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Voice confirmed and saved successfully',
        voice_id: voiceId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'reject') {
      // Delete the temporary voice from ElevenLabs
      const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': elevenlabsApiKey!,
        },
      });

      if (!deleteResponse.ok) {
        console.warn('Failed to delete voice from ElevenLabs:', voiceId);
      }

      // Clear the cloned voice from user profile
      await supabase
        .from('user_profiles')
        .update({ 
          cloned_voice_id: null,
          voice_library_status: 'not_started'
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Voice rejected and removed successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error('Invalid action. Use "confirm" or "reject"');
    }

  } catch (error) {
    console.error('Error in voice-clone-confirm function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});