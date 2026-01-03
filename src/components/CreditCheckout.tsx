import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, QrCode, CreditCard, FileText, Check, Copy, Sparkles } from 'lucide-react';

interface Package {
    id: string;
    name: string;
    price: number;
    llmCredits: number;
    voiceCredits: number;
    description: string;
    popular?: boolean;
}

const PACKAGES: Package[] = [
    {
        id: 'basico',
        name: 'Básico',
        price: 29.00,
        llmCredits: 500,
        voiceCredits: 250,
        description: 'Ideal para começar'
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 79.00,
        llmCredits: 1500,
        voiceCredits: 750,
        description: 'Mais usado',
        popular: true
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 149.00,
        llmCredits: 3000,
        voiceCredits: 1500,
        description: 'Para uso intensivo'
    }
];

interface PaymentData {
    id: string;
    status: string;
    billingType: string;
    value: number;
    dueDate: string;
    invoiceUrl?: string;
    pixQrCodeId?: string;
    pixCopiaECola?: string;
    bankSlipUrl?: string;
}

interface CreditCheckoutProps {
    onSuccess?: () => void;
}

export const CreditCheckout: React.FC<CreditCheckoutProps> = ({ onSuccess }) => {
    const { toast } = useToast();
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleSelectPackage = (pkg: Package) => {
        setSelectedPackage(pkg);
    };

    const handleCreateCharge = async (billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO') => {
        if (!selectedPackage) return;

        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
                return;
            }

            const response = await supabase.functions.invoke('asaas-create-charge', {
                body: {
                    packageId: selectedPackage.id,
                    billingType
                }
            });

            if (response.error) {
                throw new Error(response.error.message);
            }

            setPaymentData(response.data.payment);
            setShowPaymentDialog(true);

            toast({
                title: 'Cobrança criada!',
                description: `Pague via ${billingType === 'PIX' ? 'PIX' : billingType === 'CREDIT_CARD' ? 'Cartão' : 'Boleto'}`,
            });

        } catch (error: any) {
            console.error('Error creating charge:', error);
            toast({
                title: 'Erro ao criar cobrança',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Copiado!', description: 'Código PIX copiado para a área de transferência' });
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold">Escolha seu pacote</h2>
                <p className="text-muted-foreground">Créditos para usar com a IA terapêutica</p>
            </div>

            {/* Pacotes */}
            <div className="grid gap-4 md:grid-cols-3">
                {PACKAGES.map((pkg) => (
                    <Card
                        key={pkg.id}
                        className={`cursor-pointer transition-all hover:border-primary ${selectedPackage?.id === pkg.id ? 'border-primary ring-2 ring-primary/20' : ''
                            } ${pkg.popular ? 'relative' : ''}`}
                        onClick={() => handleSelectPackage(pkg)}
                    >
                        {pkg.popular && (
                            <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Popular
                            </Badge>
                        )}
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-lg">{pkg.name}</CardTitle>
                            <CardDescription>{pkg.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="text-3xl font-bold mb-4">
                                R$ {pkg.price.toFixed(2).replace('.', ',')}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>{pkg.llmCredits.toLocaleString()} créditos LLM</p>
                                <p>{pkg.voiceCredits.toLocaleString()} créditos de Voz</p>
                            </div>
                            {selectedPackage?.id === pkg.id && (
                                <Check className="h-5 w-5 text-primary mx-auto mt-3" />
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Métodos de pagamento */}
            {selectedPackage && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Forma de pagamento</CardTitle>
                        <CardDescription>
                            Pacote {selectedPackage.name} - R$ {selectedPackage.price.toFixed(2).replace('.', ',')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-3">
                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-2"
                                onClick={() => handleCreateCharge('PIX')}
                                disabled={isLoading}
                            >
                                <QrCode className="h-6 w-6 text-green-500" />
                                <span>PIX</span>
                                <span className="text-xs text-muted-foreground">Aprovação imediata</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-2"
                                onClick={() => handleCreateCharge('CREDIT_CARD')}
                                disabled={isLoading}
                            >
                                <CreditCard className="h-6 w-6 text-blue-500" />
                                <span>Cartão</span>
                                <span className="text-xs text-muted-foreground">Em até 12x</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-2"
                                onClick={() => handleCreateCharge('BOLETO')}
                                disabled={isLoading}
                            >
                                <FileText className="h-6 w-6 text-gray-500" />
                                <span>Boleto</span>
                                <span className="text-xs text-muted-foreground">1-3 dias úteis</span>
                            </Button>
                        </div>

                        {isLoading && (
                            <div className="flex items-center justify-center mt-4">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                <span>Gerando cobrança...</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Dialog de pagamento */}
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {paymentData?.billingType === 'PIX' && '💚 Pague com PIX'}
                            {paymentData?.billingType === 'CREDIT_CARD' && '💳 Pague com Cartão'}
                            {paymentData?.billingType === 'BOLETO' && '📄 Pague com Boleto'}
                        </DialogTitle>
                        <DialogDescription>
                            Valor: R$ {paymentData?.value?.toFixed(2).replace('.', ',')}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="qrcode" className="w-full">
                        {paymentData?.billingType === 'PIX' && (
                            <>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="qrcode">QR Code</TabsTrigger>
                                    <TabsTrigger value="copiacola">Copia e Cola</TabsTrigger>
                                </TabsList>

                                <TabsContent value="qrcode" className="text-center">
                                    <div className="p-4 bg-white rounded-lg inline-block">
                                        {/* QR Code será renderizado aqui */}
                                        <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                                            <QrCode className="h-32 w-32 text-gray-300" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Escaneie com o app do seu banco
                                    </p>
                                </TabsContent>

                                <TabsContent value="copiacola" className="space-y-3">
                                    <div className="p-3 bg-muted rounded-lg break-all text-xs font-mono">
                                        {paymentData?.pixCopiaECola || 'Código PIX não disponível'}
                                    </div>
                                    <Button
                                        onClick={() => copyToClipboard(paymentData?.pixCopiaECola || '')}
                                        className="w-full"
                                        variant={copied ? 'secondary' : 'default'}
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="h-4 w-4 mr-2" />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-4 w-4 mr-2" />
                                                Copiar código PIX
                                            </>
                                        )}
                                    </Button>
                                </TabsContent>
                            </>
                        )}

                        {paymentData?.billingType === 'BOLETO' && paymentData?.bankSlipUrl && (
                            <div className="text-center py-4">
                                <Button asChild className="w-full">
                                    <a href={paymentData.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Abrir Boleto
                                    </a>
                                </Button>
                            </div>
                        )}

                        {paymentData?.billingType === 'CREDIT_CARD' && paymentData?.invoiceUrl && (
                            <div className="text-center py-4">
                                <Button asChild className="w-full">
                                    <a href={paymentData.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        Pagar com Cartão
                                    </a>
                                </Button>
                            </div>
                        )}
                    </Tabs>

                    <p className="text-xs text-center text-muted-foreground">
                        Após o pagamento, seus créditos serão adicionados automaticamente.
                    </p>
                </DialogContent>
            </Dialog>
        </div>
    );
};
