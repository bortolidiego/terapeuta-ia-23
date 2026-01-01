import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

interface AsaasWebhookPayload {
    event: string;
    payment: {
        id: string;
        customer: string;
        value: number;
        status: string;
        billingType: string;
        externalReference?: string;
        dateCreated: string;
        paymentDate?: string;
        invoiceUrl?: string;
        pixQrCodeId?: string;
        pixCopiaECola?: string;
    };
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verificar token de acesso do Asaas (opcional, mas recomendado)
        const asaasToken = req.headers.get('asaas-access-token');
        const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

        if (expectedToken && asaasToken !== expectedToken) {
            console.warn('Invalid Asaas webhook token');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const payload: AsaasWebhookPayload = await req.json();
        console.log('Asaas webhook received:', JSON.stringify(payload, null, 2));

        const { event, payment } = payload;

        // Extrair user_id e package do externalReference
        // Formato esperado: "user_id:package_name" ou apenas o purchase_id
        const externalRef = payment.externalReference || '';

        // Buscar a compra pendente pelo payment_id do Asaas
        const { data: purchase, error: purchaseError } = await supabase
            .from('credit_purchases')
            .select('*')
            .eq('asaas_payment_id', payment.id)
            .single();

        if (purchaseError && purchaseError.code !== 'PGRST116') {
            console.error('Error fetching purchase:', purchaseError);
        }

        switch (event) {
            case 'PAYMENT_CONFIRMED':
            case 'PAYMENT_RECEIVED':
                // Pagamento confirmado - creditar ao usuário
                if (purchase) {
                    // Atualizar status da compra
                    await supabase
                        .from('credit_purchases')
                        .update({
                            status: 'confirmed',
                            confirmed_at: new Date().toISOString()
                        })
                        .eq('id', purchase.id);

                    // Adicionar créditos ao usuário
                    const { data: currentCredits } = await supabase
                        .from('user_credits')
                        .select('*')
                        .eq('user_id', purchase.user_id)
                        .single();

                    if (currentCredits) {
                        await supabase
                            .from('user_credits')
                            .update({
                                openai_credits: (currentCredits.openai_credits || 0) + (purchase.llm_credits_added || 0),
                                elevenlabs_credits: (currentCredits.elevenlabs_credits || 0) + (purchase.voice_credits_added || 0),
                            })
                            .eq('user_id', purchase.user_id);
                    }

                    // Registrar no histórico de uso
                    await supabase
                        .from('usage_tracking')
                        .insert({
                            user_id: purchase.user_id,
                            service: 'asaas',
                            operation_type: 'credit_purchase',
                            cost_usd: 0,
                            tokens_used: 0,
                            metadata: {
                                package_name: purchase.package_name,
                                llm_credits: purchase.llm_credits_added,
                                voice_credits: purchase.voice_credits_added,
                                amount_brl: purchase.amount_brl
                            }
                        });

                    // Criar notificação para o usuário
                    await supabase
                        .from('user_notifications')
                        .insert({
                            user_id: purchase.user_id,
                            type: 'credits_added',
                            title: 'Créditos Adicionados!',
                            message: `Seus créditos foram adicionados: ${purchase.llm_credits_added} LLM + ${purchase.voice_credits_added} Voz`,
                            metadata: { purchase_id: purchase.id }
                        });

                    console.log(`Credits added for user ${purchase.user_id}`);
                }
                break;

            case 'PAYMENT_OVERDUE':
            case 'PAYMENT_DELETED':
            case 'PAYMENT_REFUNDED':
                // Pagamento falhou ou foi reembolsado
                if (purchase) {
                    await supabase
                        .from('credit_purchases')
                        .update({ status: 'failed' })
                        .eq('id', purchase.id);

                    console.log(`Purchase ${purchase.id} marked as failed`);
                }
                break;

            case 'PAYMENT_CREATED':
                // Cobrança criada - apenas log
                console.log(`Payment created: ${payment.id}`);
                break;

            default:
                console.log(`Unhandled event: ${event}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
