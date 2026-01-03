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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('Iniciando atualização diária de trânsitos...');

        // 1. Buscar todos os usuários com mapa configurado
        const { data: users, error: userError } = await supabase
            .from('user_astro_data')
            .select('user_id, last_transit_sync, is_configured')
            .eq('is_configured', true);

        if (userError) throw userError;

        console.log(`Encontrados ${users?.length || 0} usuários para atualizar.`);

        const results = { success: 0, failed: 0, errors: [] };

        // 2. Para cada usuário, invocar a função astro-chart
        // Nota: Em produção com muitos usuários, isso deveria ser uma fila (queue)
        for (const user of users || []) {
            try {
                // Verificar se já atualizou hoje (evitar duplicação se rodar 2x)
                const lastSync = user.last_transit_sync ? new Date(user.last_transit_sync) : new Date(0);
                const today = new Date();
                const isSameDay = lastSync.getDate() === today.getDate() &&
                    lastSync.getMonth() === today.getMonth() &&
                    lastSync.getFullYear() === today.getFullYear();

                if (isSameDay) {
                    // console.log(`Usuário ${user.user_id} já atualizado hoje.`);
                    continue;
                }

                // Invocar astro-chart para atualizar (reutiliza a lógica existente)
                // A função astro-chart já tem lógica para buscar trânsitos se chamada
                const { error } = await supabase.functions.invoke('astro-chart', {
                    body: { userId: user.user_id }
                });

                if (error) throw error;
                results.success++;

            } catch (err) {
                console.error(`Erro ao atualizar usuário ${user.user_id}:`, err);
                results.failed++;
                results.errors.push({ userId: user.user_id, error: err.message });
            }
        }

        console.log('Atualização concluída:', results);

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Fatal Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
