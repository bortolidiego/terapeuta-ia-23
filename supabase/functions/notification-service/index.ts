import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { action, ...params } = await req.json();

    let result = {};

    switch (action) {
      case 'get_notifications':
        const { data: notifications } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        result = { notifications: notifications || [] };
        break;

      case 'mark_as_read':
        const { notificationIds } = params;
        await supabase
          .from('user_notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .in('id', notificationIds);

        result = { success: true };
        break;

      case 'mark_all_as_read':
        await supabase
          .from('user_notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);

        result = { success: true };
        break;

      case 'create_notification':
        const { type, title, message, metadata } = params;
        
        const { data: newNotification } = await supabase
          .from('user_notifications')
          .insert({
            user_id: user.id,
            type,
            title,
            message,
            metadata: metadata || {}
          })
          .select()
          .single();

        result = { notification: newNotification };
        break;

      case 'get_unread_count':
        const { count } = await supabase
          .from('user_notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('read', false);

        result = { unread_count: count || 0 };
        break;

      case 'delete_notification':
        const { notificationId } = params;
        await supabase
          .from('user_notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('id', notificationId);

        result = { success: true };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in notification-service function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});