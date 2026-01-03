import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Sparkles, Heart, Brain, Zap, Moon, Pill, Users } from "lucide-react";

interface ProtocolSimplesProps {
    sessionId: string;
    protocolType: string;
    userMessage: string;
    onComplete: (result: any) => void;
}

// Configurações de cada protocolo
const PROTOCOL_CONFIG: Record<string, {
    title: string;
    description: string;
    icon: React.ElementType;
    fields: Array<{
        name: string;
        label: string;
        placeholder: string;
        type: 'text' | 'textarea' | 'multiselect';
        required: boolean;
    }>;
    action: string;
}> = {
    condicionamentos: {
        title: "Transformação de Condicionamentos",
        description: "Vamos trabalhar para transformar padrões de pensamento ou comportamento que você identificou.",
        icon: Brain,
        fields: [
            { name: 'padrao', label: 'Qual é o padrão?', placeholder: 'Ex: pensar que não sou capaz', type: 'text', required: true }
        ],
        action: 'generate_condicionamentos'
    },
    crencas: {
        title: "Liberação de Crenças",
        description: "Vamos trabalhar para liberar crenças que você absorveu de outras pessoas.",
        icon: Users,
        fields: [
            { name: 'crenca', label: 'Qual é a crença?', placeholder: 'Ex: eu não valorizo dinheiro', type: 'text', required: true },
            { name: 'pessoa', label: 'De quem você absorveu?', placeholder: 'Ex: minha mãe', type: 'text', required: false }
        ],
        action: 'generate_crencas'
    },
    hereditariedades: {
        title: "Liberação de Hereditariedades",
        description: "Vamos trabalhar para liberar padrões herdados da sua família.",
        icon: Users,
        fields: [
            { name: 'padrao', label: 'Qual é o padrão hereditário?', placeholder: 'Ex: ansiedade que meu pai tinha', type: 'text', required: true }
        ],
        action: 'generate_hereditariedades'
    },
    sequencia_generica: {
        title: "Sequência de Transformação",
        description: "Uma sequência completa de 24 comandos para trabalhar um tema amplo.",
        icon: Sparkles,
        fields: [
            { name: 'tema', label: 'Qual é o tema?', placeholder: 'Ex: dívidas, obesidade, problemas financeiros', type: 'text', required: true }
        ],
        action: 'generate_generic_sequence'
    },
    sequencia_dependencia: {
        title: "Liberação de Dependência",
        description: "Trabalhando as camadas de prazer, desejo, apego e dependência.",
        icon: Zap,
        fields: [
            { name: 'compulsao', label: 'Qual é a compulsão/vício?', placeholder: 'Ex: comida, cigarro, celular', type: 'text', required: true }
        ],
        action: 'generate_dependency_sequence'
    },
    desconexao_parcial: {
        title: "Desconexão Parcial",
        description: "Cortar emaranhamentos negativos mantendo a conexão positiva com a pessoa.",
        icon: Users,
        fields: [
            { name: 'pessoa', label: 'De quem deseja se desconectar parcialmente?', placeholder: 'Ex: meu pai, minha ex', type: 'text', required: true }
        ],
        action: 'generate_disconnection_partial'
    },
    desconexao_total: {
        title: "Desconexão Total",
        description: "Cortar completamente os emaranhamentos com uma pessoa.",
        icon: Users,
        fields: [
            { name: 'pessoa', label: 'De quem deseja se desconectar totalmente?', placeholder: 'Ex: pessoa tóxica', type: 'text', required: true }
        ],
        action: 'generate_disconnection_total'
    },
    desconexao_fora_materia: {
        title: "Desconexão de Energias Negativas",
        description: "Desconectar de consciências negativas que estão ao seu redor.",
        icon: Sparkles,
        fields: [],
        action: 'generate_disconnection_fora_materia'
    },
    limpeza_diaria: {
        title: "Limpeza Diária",
        description: "Limpar todos os sentimentos e informações prejudiciais do dia.",
        icon: Moon,
        fields: [],
        action: 'generate_cleanup_daily'
    },
    limpeza_pos_desconexao: {
        title: "Limpeza Pós-Conexão",
        description: "Limpar após uma conexão específica com alguém.",
        icon: Sparkles,
        fields: [
            { name: 'pessoa', label: 'Com quem foi a conexão?', placeholder: 'Ex: meu chefe, cliente difícil', type: 'text', required: true },
            { name: 'contexto', label: 'Em qual contexto? (opcional)', placeholder: 'Ex: reunião de trabalho', type: 'text', required: false }
        ],
        action: 'generate_cleanup_post_connection'
    },
    programacao_emocional: {
        title: "Programação Emocional",
        description: "Programar estados emocionais desejados.",
        icon: Heart,
        fields: [
            { name: 'estados', label: 'Quais estados emocionais deseja programar?', placeholder: 'Ex: amor, paz, tranquilidade, confiança', type: 'text', required: true }
        ],
        action: 'generate_programming_emotional'
    },
    programacao_mental: {
        title: "Programação Mental",
        description: "Fortalecer novos padrões mentais positivos.",
        icon: Brain,
        fields: [
            { name: 'padrao', label: 'Qual padrão deseja fortalecer?', placeholder: 'Ex: pensar positivo, ter foco', type: 'text', required: true }
        ],
        action: 'generate_programming_mental'
    },
    programacao_material: {
        title: "Programação Material",
        description: "Programar situações de vida desejadas.",
        icon: Sparkles,
        fields: [
            { name: 'situacao', label: 'Qual situação deseja manifestar?', placeholder: 'Ex: tenho abundância financeira', type: 'text', required: true }
        ],
        action: 'generate_programming_material'
    },
    desintoxicacao_quantica: {
        title: "Desintoxicação Quântica",
        description: "Eliminar toxinas do corpo de forma quântica.",
        icon: Pill,
        fields: [
            { name: 'substancia', label: 'Qual substância deseja eliminar?', placeholder: 'Ex: álcool, açúcar, medicamentos', type: 'text', required: true }
        ],
        action: 'generate_detox'
    },
    antes_ingerir_substancias: {
        title: "Antes de Ingerir Substâncias",
        description: "Preparar o corpo antes de ingerir algo potencialmente nocivo.",
        icon: Pill,
        fields: [
            { name: 'substancia', label: 'O que vai ingerir?', placeholder: 'Ex: álcool, remédio, comida pesada', type: 'text', required: true }
        ],
        action: 'generate_before_ingesting'
    },
    gerar_substancias: {
        title: "Gerar Substâncias",
        description: "Comandar o corpo a produzir substâncias benéficas naturalmente.",
        icon: Sparkles,
        fields: [
            { name: 'substancia', label: 'Qual substância deseja gerar?', placeholder: 'Ex: serotonina, dopamina, melatonina', type: 'text', required: true }
        ],
        action: 'generate_substance'
    }
};

export const ProtocolSimples = ({ sessionId, protocolType, userMessage, onComplete }: ProtocolSimplesProps) => {
    const config = PROTOCOL_CONFIG[protocolType];
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    if (!config) {
        return (
            <div className="p-6 text-center space-y-4">
                <p className="text-muted-foreground">Protocolo não configurado: {protocolType}</p>
                <Button variant="outline" size="sm" onClick={() => onComplete({ type: 'cancelled' })}>
                    <X className="h-4 w-4 mr-2" />
                    Voltar ao chat
                </Button>
            </div>
        );
    }

    const handleChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        // Validar campos obrigatórios
        for (const field of config.fields) {
            if (field.required && (!formData[field.name] || !formData[field.name].trim())) {
                toast({
                    title: "Campo obrigatório",
                    description: `Por favor, preencha: ${field.label}`,
                    variant: "destructive",
                });
                return;
            }
        }

        setIsSubmitting(true);

        try {
            // Preparar dados para a action
            const actionData: Record<string, any> = {};
            for (const field of config.fields) {
                if (formData[field.name]) {
                    // Para programacao_emocional, converter string em array
                    if (field.name === 'estados') {
                        actionData[field.name] = formData[field.name].split(',').map(s => s.trim());
                    } else {
                        actionData[field.name] = formData[field.name].trim();
                    }
                }
            }

            const { data, error } = await supabase.functions.invoke('protocol-executor', {
                body: {
                    sessionId,
                    action: config.action,
                    actionData
                }
            });

            if (error) throw error;

            toast({
                title: "Protocolo gerado!",
                description: "Seu áudio de autocura está sendo preparado.",
            });

            onComplete({
                type: 'protocol_generated',
                protocolType,
                data
            });
        } catch (error) {
            console.error('Erro ao gerar protocolo:', error);
            toast({
                title: "Erro",
                description: "Não foi possível gerar o protocolo. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        // Cancelar protocolo ativo no banco
        await supabase
            .from('session_protocols')
            .update({ status: 'cancelled' })
            .eq('session_id', sessionId)
            .eq('status', 'active');

        onComplete({ type: 'cancelled', message: 'Protocolo cancelado pelo usuário.' });
    };

    const Icon = config.icon;

    return (
        <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">{config.title}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {config.fields.length > 0 ? (
                    config.fields.map(field => (
                        <div key={field.name} className="space-y-2">
                            <Label htmlFor={field.name}>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {field.type === 'textarea' ? (
                                <Textarea
                                    id={field.name}
                                    placeholder={field.placeholder}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    className="min-h-[80px]"
                                />
                            ) : (
                                <Input
                                    id={field.name}
                                    placeholder={field.placeholder}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Este protocolo não requer informações adicionais. Clique em "Gerar Autocura" para continuar.
                    </p>
                )}

                <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Gerar Autocura
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default ProtocolSimples;
