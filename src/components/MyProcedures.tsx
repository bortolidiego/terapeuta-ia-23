import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Play, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Procedure {
    id: string;
    name: string;
    description: string;
    frequency: string;
    created_at: string;
    activated_1000x: boolean;
    activated_1000x_at: string | null;
    activation_count: number;
}

export const MyProcedures = () => {
    const [procedures, setProcedures] = useState<Procedure[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        loadProcedures();
    }, []);

    const loadProcedures = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_procedures')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProcedures(data || []);
        } catch (error) {
            console.error('Error loading procedures:', error);
            toast({
                title: "Erro",
                description: "Não foi possível carregar os procedimentos.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleActivate1000x = async (procedureId: string) => {
        setProcessingId(procedureId);
        try {
            const { data, error } = await supabase.functions.invoke('protocol-executor', {
                body: {
                    action: 'activate_procedure_1000x',
                    procedure_id: procedureId
                }
            });

            if (error) throw error;

            toast({
                title: "Potencialização Iniciada!",
                description: "O procedimento foi configurado para a técnica 1000x. Siga as instruções no chat ou aguarde a geração do áudio.",
            });

            // Atualizar lista
            await loadProcedures();

        } catch (error: any) {
            console.error('Error activating 1000x:', error);
            toast({
                title: "Erro na potencialização",
                description: error.message || "Não foi possível ativar a técnica 1000x.",
                variant: "destructive",
            });
        } finally {
            setProcessingId(null);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Meus Procedimentos</CardTitle>
                <CardDescription>
                    Gerencie seus procedimentos de autocura e aplique a técnica de potencialização (1000x).
                </CardDescription>
            </CardHeader>
            <CardContent>
                {procedures.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p className="mb-2">Você ainda não tem procedimentos criados.</p>
                        <p className="text-sm">Peça ao terapeuta para agrupar seus protocolos em um procedimento.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {procedures.map((proc) => (
                            <Card key={proc.id} className={`border ${proc.activated_1000x ? 'border-purple-200 bg-purple-50/20' : 'border-border'}`}>
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                {proc.name}
                                                {proc.activated_1000x && (
                                                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                                                        1000x ATIVO
                                                    </Badge>
                                                )}
                                            </h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {proc.description || 'Sem descrição'}
                                            </p>
                                        </div>
                                        {proc.frequency === 'daily' && (
                                            <Badge variant="outline" className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Diário
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-6">
                                        <div className="text-sm text-muted-foreground">
                                            {proc.activation_count > 0 ? (
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                    {proc.activation_count} ativações
                                                </span>
                                            ) : (
                                                <span>Nunca ativado</span>
                                            )}
                                        </div>

                                        {!proc.activated_1000x ? (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                                        disabled={!!processingId}
                                                    >
                                                        {processingId === proc.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                        ) : (
                                                            <Zap className="w-4 h-4 mr-2" />
                                                        )}
                                                        Potencializar (1000x)
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Potencializar Procedimento?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação aplicará a técnica de aninhamento (10x &rarr; 100x &rarr; 1000x) para criar uma ativação massiva.
                                                            <br /><br />
                                                            Isso equivale a anos de repetição diária executados em um único momento. Você está pronto para essa liberação definitiva?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleActivate1000x(proc.id)}
                                                            className="bg-purple-600 hover:bg-purple-700"
                                                        >
                                                            Sim, liberar agora
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        ) : (
                                            <Button variant="outline" disabled className="text-green-600 border-green-200 bg-green-50">
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Concluído
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
