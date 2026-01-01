import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pacotes disponíveis
const PACKAGES = {
    basico: {
        name: 'Básico',
        price_brl: 29.00,
        llm_credits: 500,
        voice_credits: 250,
        description: '500 créditos LLM + 250 créditos de Voz'
    },
    premium: {
        name: 'Premium',
        price_brl: 79.00,
        llm_credits: 1500,
        voice_credits: 750,
        description: '1500 créditos LLM + 750 créditos de Voz + Mapa Astral'
    },
    pro: {
        name: 'Pro',
        price_brl: 149.00,
        llm_credits: 3000,
        voice_credits: 1500,
        description: '3000 créditos LLM + 1500 créditos de Voz + Múltiplas vozes'
    }
};

interface CreateChargeRequest {
    packageId: 'basico' | 'premium' | 'pro';
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verificar autenticação
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { packageId, billingType }: CreateChargeRequest = await req.json();

        const selectedPackage = PACKAGES[packageId];
        if (!selectedPackage) {
            return new Response(JSON.stringify({ error: 'Invalid package' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
        if (!asaasApiKey) {
            throw new Error('Asaas API key not configured');
        }

        // Determinar ambiente (sandbox ou produção)
        const asaasBaseUrl = Deno.env.get('ASAAS_SANDBOX') === 'true'
            ? 'https://sandbox.asaas.com/api/v3'
            : 'https://api.asaas.com/v3';

        // Buscar ou criar cliente no Asaas
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, cpf_cnpj, email, asaas_customer_id')
            .eq('id', user.id)
            .single();

        let customerId = profile?.asaas_customer_id;

        if (!customerId) {
            // Criar cliente no Asaas
            const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
                method: 'POST',
                headers: {
                    'access_token': asaasApiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: profile?.full_name || user.email,
                    email: user.email,
                    cpfCnpj: profile?.cpf_cnpj || undefined,
                    externalReference: user.id,
                }),
            });

            const customerData = await customerResponse.json();

            if (!customerResponse.ok) {
                console.error('Error creating Asaas customer:', customerData);
                throw new Error('Failed to create customer');
            }

            customerId = customerData.id;

            // Salvar customer_id no perfil
            await supabase
                .from('profiles')
                .update({ asaas_customer_id: customerId })
                .eq('id', user.id);
        }

        // Criar cobrança no Asaas
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3); // Vencimento em 3 dias

        const chargeResponse = await fetch(`${asaasBaseUrl}/payments`, {
            method: 'POST',
            headers: {
                'access_token': asaasApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer: customerId,
                billingType: billingType,
                value: selectedPackage.price_brl,
                dueDate: dueDate.toISOString().split('T')[0],
                description: `Terapeuta IA - Pacote ${selectedPackage.name}`,
                externalReference: user.id,
            }),
        });

        const chargeData = await chargeResponse.json();

        if (!chargeResponse.ok) {
            console.error('Error creating Asaas charge:', chargeData);
            throw new Error('Failed to create charge');
        }

        // Registrar compra pendente no banco
        const { data: purchase, error: purchaseError } = await supabase
            .from('credit_purchases')
            .insert({
                user_id: user.id,
                asaas_payment_id: chargeData.id,
                package_name: selectedPackage.name,
                llm_credits_added: selectedPackage.llm_credits,
                voice_credits_added: selectedPackage.voice_credits,
                amount_brl: selectedPackage.price_brl,
                payment_method: billingType.toLowerCase(),
                status: 'pending',
            })
            .select()
            .single();

        if (purchaseError) {
            console.error('Error saving purchase:', purchaseError);
        }

        // Retornar dados do pagamento
        return new Response(JSON.stringify({
            success: true,
            payment: {
                id: chargeData.id,
                status: chargeData.status,
                billingType: chargeData.billingType,
                value: chargeData.value,
                dueDate: chargeData.dueDate,
                invoiceUrl: chargeData.invoiceUrl,
                pixQrCodeId: chargeData.pixQrCodeId,
                pixCopiaECola: chargeData.pixCopiaECola,
                bankSlipUrl: chargeData.bankSlipUrl,
            },
            package: selectedPackage,
            purchaseId: purchase?.id,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error creating charge:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
