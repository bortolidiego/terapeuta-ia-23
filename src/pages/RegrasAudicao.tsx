import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Moon,
    Volume2,
    Clock,
    Calendar,
    AlertTriangle,
    CheckCircle,
    Play,
    Pause,
    RotateCcw
} from "lucide-react";

export const RegrasAudicao = () => {
    return (
        <div className="container mx-auto py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">📖 Regras de Audição</h1>
                    <p className="text-muted-foreground">
                        Siga estas orientações para garantir a eficácia do seu protocolo de autocura
                    </p>
                </div>

                {/* Introdução */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                        <p className="text-sm leading-relaxed">
                            O método de autocura utiliza <strong>comandos quânticos</strong> que devem ser emitidos
                            seguindo regras específicas para ativar o processo de transformação emocional, mental e física.
                            A audição consciente e ininterrupta é fundamental para o sucesso do tratamento.
                        </p>
                    </CardContent>
                </Card>

                {/* Regras Principais */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Regras Obrigatórias</h2>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-3 text-lg">
                                <Moon className="h-6 w-6 text-blue-500" />
                                1. Ambiente Tranquilo
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Escolha um local calmo, sem distrações ou interrupções.
                                O ambiente deve permitir que você mantenha foco total na audição.
                            </p>
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs">
                                    <strong>Dica:</strong> Antes de dormir ou ao acordar são os momentos ideais,
                                    pois sua mente está mais receptiva.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-3 text-lg">
                                <AlertTriangle className="h-6 w-6 text-amber-500" />
                                2. Emissão Ininterrupta
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                <strong>Nunca pause</strong> o áudio durante a emissão de um procedimento.
                                Ouça do início ao fim sem interrupções. Se for interrompido,
                                recomece o procedimento desde o início.
                            </p>
                            <div className="mt-3 flex items-center gap-4 text-xs text-destructive">
                                <Pause className="h-4 w-4" />
                                <span>Pausar = Procedimento invalidado</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-3 text-lg">
                                <Volume2 className="h-6 w-6 text-green-500" />
                                3. Atenção Plena
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Não ouça os protocolos enquanto dirige, trabalha ou realiza outras atividades.
                                Sua consciência precisa estar presente e focada nas palavras emitidas.
                            </p>
                            <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                                <p className="text-xs text-destructive">
                                    ⚠️ Audição distraída reduz drasticamente a eficácia do tratamento.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-3 text-lg">
                                <RotateCcw className="h-6 w-6 text-purple-500" />
                                4. Consistência é Chave
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Protocolos recorrentes devem ser ouvidos <strong>diariamente</strong> por
                                pelo menos <strong>40 dias consecutivos</strong> para resultados duradouros.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tipos de Protocolos */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Tipos de Protocolos</h2>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-green-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    Único (TEE)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Transformação Emocional Específica. Ouvir <strong>apenas 1 vez na vida</strong>
                                    para cada evento traumático único.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-blue-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                    Recorrente
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Transformação Recorrente, Padrões Mentais, Limpeza Diária.
                                    Ouvir <strong>1x ao dia</strong> por 40 dias.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-amber-500" />
                                    Eventual
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Desintoxicação, Limpeza pré-ingestão.
                                    Ouvir <strong>quando a situação ocorrer</strong>.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Ativação x1000 */}
                <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            🚀 Ativação x1000
                        </CardTitle>
                        <CardDescription>Recurso avançado para procedimentos recorrentes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Procedimentos podem ser configurados para ativação multiplicada (x10, x100, x1000).
                            Isso significa que uma única audição equivale a <strong>1000 ativações</strong>,
                            eliminando a necessidade de ouvir diariamente por anos.
                        </p>
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs">
                                <strong>Exemplo:</strong> Um procedimento recorrente de 40 dias × 1000 = 40.000 dias
                                de efeito com uma única audição.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Dicas Finais */}
                <Card>
                    <CardHeader>
                        <CardTitle>💡 Dicas para Melhor Resultado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Use fones de ouvido para maior imersão e privacidade
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Mantenha um diário de progresso para acompanhar mudanças
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Não se preocupe se adormecer durante - sua consciência continua processando
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Resultados podem levar de dias a semanas para se manifestar
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
