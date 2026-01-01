import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Moon, Volume2, Clock, Calendar } from 'lucide-react';
import { useState } from 'react';

interface AudioRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    protocolType?: 'unique' | 'recurrent' | 'eventual';
}

export const AudioRulesModal: React.FC<AudioRulesModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    protocolType = 'recurrent'
}) => {
    const [acceptedRules, setAcceptedRules] = useState(false);

    const handleAccept = () => {
        if (acceptedRules) {
            onAccept();
            setAcceptedRules(false);
        }
    };

    const getFrequencyText = () => {
        switch (protocolType) {
            case 'unique':
                return 'Este protocolo deve ser ouvido apenas 1 vez na vida.';
            case 'eventual':
                return 'Ouça este protocolo quando a situação ocorrer.';
            case 'recurrent':
            default:
                return 'Este protocolo deve ser ouvido 1 vez ao dia, por 40 dias.';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Volume2 className="h-5 w-5 text-primary" />
                        Regras de Audição
                    </DialogTitle>
                    <DialogDescription>
                        Para garantir a eficácia do seu protocolo de autocura
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Regra 1: Ambiente */}
                    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <Moon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-sm">Ambiente Tranquilo</p>
                            <p className="text-xs text-muted-foreground">
                                Ouça em local calmo, sem distrações. Idealmente antes de dormir ou ao acordar.
                            </p>
                        </div>
                    </div>

                    {/* Regra 2: Não pausar */}
                    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-sm">Emissão Ininterrupta</p>
                            <p className="text-xs text-muted-foreground">
                                Não pause durante a audição. Ouça do início ao fim sem interrupções.
                            </p>
                        </div>
                    </div>

                    {/* Regra 3: Atenção */}
                    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <Volume2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-sm">Atenção Plena</p>
                            <p className="text-xs text-muted-foreground">
                                Não ouça enquanto dirige, trabalha ou faz outras atividades.
                            </p>
                        </div>
                    </div>

                    {/* Regra 4: Frequência */}
                    <div className="flex gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-sm">Frequência</p>
                            <p className="text-xs text-muted-foreground">
                                {getFrequencyText()}
                            </p>
                        </div>
                    </div>

                    {/* Checkbox de aceitação */}
                    <div className="flex items-start gap-3 pt-2">
                        <Checkbox
                            id="accept-rules"
                            checked={acceptedRules}
                            onCheckedChange={(checked) => setAcceptedRules(checked === true)}
                        />
                        <label
                            htmlFor="accept-rules"
                            className="text-sm text-muted-foreground cursor-pointer leading-tight"
                        >
                            Li e compreendo as regras de audição para garantir a eficácia do meu protocolo de autocura.
                        </label>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleAccept} disabled={!acceptedRules}>
                        Iniciar Audição
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
