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
            {/* Notificação de atualização - Topo da tela */}
            {hasUpdate && (
                <div className="fixed top-0 left-0 w-full z-50 animate-in slide-in-from-top-2 shadow-md">
                    <div className="bg-primary text-primary-foreground p-3 flex items-center justify-between gap-4 px-4 sm:px-8">
                        <div className="flex items-center gap-3">
                            <Sparkles className="h-5 w-5 animate-pulse" />
                            <div>
                                <p className="text-sm font-medium">
                                    Nova versão {currentVersion.version} disponível!
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleUpdate}
                                className="h-8 text-xs font-semibold whitespace-nowrap"
                            >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Atualizar Agora
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleViewChangelog}
                                className="h-8 text-xs hover:bg-white/20 text-white hover:text-white hidden sm:flex"
                            >
                                Ver novidades
                            </Button>
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
