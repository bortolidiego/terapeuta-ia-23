import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Mic, Trash2, Play, Pause } from 'lucide-react';
import { useAudioDraft } from '@/hooks/useAudioDraft';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DraftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  textDraft?: string;
  onRestoreTextDraft?: () => void;
  onClearTextDraft?: () => void;
}

export const DraftsDialog = ({
  open,
  onOpenChange,
  sessionId,
  textDraft,
  onRestoreTextDraft,
  onClearTextDraft
}: DraftsDialogProps) => {
  const {
    audioDrafts,
    isLoadingDrafts,
    loadAudioDrafts,
    deleteAudioDraft,
    getAudioUrl
  } = useAudioDraft(sessionId);
  
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (open) {
      loadAudioDrafts();
    }
  }, [open, loadAudioDrafts]);

  const handlePlayAudio = async (draftId: string, audioPath: string) => {
    try {
      if (playingAudio === draftId) {
        // Pause current audio
        const audio = audioElements.get(draftId);
        if (audio) {
          audio.pause();
          setPlayingAudio(null);
        }
        return;
      }

      // Stop any currently playing audio
      if (playingAudio) {
        const currentAudio = audioElements.get(playingAudio);
        if (currentAudio) {
          currentAudio.pause();
        }
      }

      // Get or create audio element
      let audio = audioElements.get(draftId);
      if (!audio) {
        const url = await getAudioUrl(audioPath);
        if (!url) return;

        audio = new Audio(url);
        audio.onended = () => setPlayingAudio(null);
        audio.onerror = () => setPlayingAudio(null);
        
        setAudioElements(prev => new Map(prev).set(draftId, audio!));
      }

      audio.play();
      setPlayingAudio(draftId);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Duração desconhecida';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const totalDrafts = (textDraft ? 1 : 0) + audioDrafts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Rascunhos Salvos
            {totalDrafts > 0 && (
              <Badge variant="secondary">{totalDrafts}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Texto
              {textDraft && <Badge variant="secondary">1</Badge>}
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Áudio
              {audioDrafts.length > 0 && (
                <Badge variant="secondary">{audioDrafts.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4">
            <ScrollArea className="h-[400px]">
              {textDraft ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Rascunho de Texto</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onRestoreTextDraft}
                        >
                          Restaurar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onClearTextDraft}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {textDraft}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum rascunho de texto encontrado</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="audio" className="mt-4">
            <ScrollArea className="h-[400px]">
              {isLoadingDrafts ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando rascunhos...
                </div>
              ) : audioDrafts.length > 0 ? (
                <div className="space-y-3">
                  {audioDrafts.map((draft) => (
                    <Card key={draft.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePlayAudio(draft.id, draft.audio_path)}
                            >
                              {playingAudio === draft.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <div>
                              <p className="text-sm font-medium">
                                {formatDuration(draft.audio_duration)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(draft.created_at), {
                                  addSuffix: true,
                                  locale: ptBR
                                })}
                                {draft.audio_size && ` • ${formatFileSize(draft.audio_size)}`}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteAudioDraft(draft.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum rascunho de áudio encontrado</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};