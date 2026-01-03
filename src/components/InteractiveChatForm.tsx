import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Send } from "lucide-react";

interface InteractiveChatFormProps {
    questions: string[];
    onSubmit: (answers: string[]) => void;
    isSubmitting?: boolean;
}

export const InteractiveChatForm = ({ questions, onSubmit, isSubmitting = false }: InteractiveChatFormProps) => {
    const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(""));

    const handleChange = (index: number, value: string) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = () => {
        // Validar se pelo menos uma resposta foi preenchida? 
        // Por enquanto, permitimos envio parcial, mas idealmente usuário deve responder tudo.
        onSubmit(answers);
    };

    return (
        <Card className="w-full max-w-md bg-card/50 border-primary/20 mt-4">
            <CardContent className="p-4 space-y-4">
                {questions.map((question, index) => (
                    <div key={index} className="space-y-2">
                        <Label className="text-sm font-medium text-foreground/90">{question}</Label>
                        {question.toLowerCase().includes("descreva") || question.toLowerCase().includes("detalhe") ? (
                            <Textarea
                                value={answers[index]}
                                onChange={(e) => handleChange(index, e.target.value)}
                                placeholder="Digite sua resposta..."
                                className="min-h-[80px] text-sm bg-background/80"
                            />
                        ) : (
                            <Input
                                value={answers[index]}
                                onChange={(e) => handleChange(index, e.target.value)}
                                placeholder="Sua resposta..."
                                className="h-9 text-sm bg-background/80"
                            />
                        )}
                    </div>
                ))}

                <div className="pt-2 flex justify-end">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || answers.every(a => !a.trim())}
                        size="sm"
                        className="w-full sm:w-auto"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        Enviar Respostas
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
