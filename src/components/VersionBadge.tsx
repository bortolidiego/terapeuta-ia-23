import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVersion, markVersionAsSeen } from '@/hooks/useVersion';
import { Info, RefreshCw, Sparkles } from 'lucide-react';

export const VersionBadge: React.FC = () => {
    const { currentVersion, hasUpdate, isLoading } = useVersion();
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelog, setChangelog] = useState<string>('');
    const [loadingChangelog, setLoadingChangelog] = useState(false);

    if (isLoading || !currentVersion) {
        return null;
    }

    const handleViewChangelog = async () => {
        setShowChangelog(true);
        setLoadingChangelog(true);

        try {
            // Carregar changelog do arquivo markdown
            const response = await fetch('/docs/CHANGELOG.md');
            if (response.ok) {
                const text = await response.text();
                setChangelog(text);
            } else {
                setChangelog('# Changelog\n\nNenhum changelog disponível.');
            }
        } catch {
            setChangelog('# Changelog\n\nErro ao carregar changelog.');
        } finally {
            setLoadingChangelog(false);
        }
    };

    const handleUpdate = () => {
        markVersionAsSeen(currentVersion.version);
        window.location.reload();
    };

    const handleCloseChangelog = () => {
        setShowChangelog(false);
        if (hasUpdate) {
            markVersionAsSeen(currentVersion.version);
        }
    };

    return (
        <>
            {/* Badge de versão discreto */}
            <button
                onClick={handleViewChangelog}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
                <Info className="h-3 w-3" />
                <span>v{currentVersion.version}</span>
                {hasUpdate && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/10 text-primary">
                        Novo!
                    </Badge>
                )}
            </button>

            {/* Notificação de atualização */}
            {hasUpdate && (
                <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
                    <div className="bg-background border rounded-lg shadow-lg p-4 max-w-sm">
                        <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-sm">Nova versão disponível!</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    v{currentVersion.version} traz novas funcionalidades.
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <Button size="sm" onClick={handleUpdate} className="h-7 text-xs">
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Atualizar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleViewChangelog}
                                        className="h-7 text-xs"
                                    >
                                        Ver mudanças
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialog com Changelog */}
            <Dialog open={showChangelog} onOpenChange={handleCloseChangelog}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Novidades - v{currentVersion.version}
                        </DialogTitle>
                        <DialogDescription>
                            Confira as últimas atualizações do Terapeuta IA
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[400px] pr-4">
                        {loadingChangelog ? (
                            <div className="flex items-center justify-center h-32">
                                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <pre className="whitespace-pre-wrap text-sm font-sans">
                                    {changelog}
                                </pre>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
};
