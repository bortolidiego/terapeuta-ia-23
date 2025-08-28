import { useEffect, useState } from 'react';
import { useAudioAssembly } from '@/hooks/useAudioAssembly';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Play, Download, Volume2 } from 'lucide-react';

interface AudioAssemblyNotificationProps {
  sessionId?: string;
  onAudioReady?: (audioUrl: string) => void;
}

export const AudioAssemblyNotification = ({ sessionId, onAudioReady }: AudioAssemblyNotificationProps) => {
  const { currentJob, isProcessing, getAudioUrl } = useAudioAssembly(sessionId);
  const { toast } = useToast();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Gerar URL do áudio quando o job estiver completo
  useEffect(() => {
    if (currentJob?.status === 'completed' && currentJob.result_audio_path && !audioUrl) {
      getAudioUrl(currentJob.result_audio_path)
        .then((url) => {
          if (url) {
            setAudioUrl(url);
            onAudioReady?.(url);
          }
        })
        .catch((error) => {
          console.error('Erro ao gerar URL do áudio:', error);
        });
    }
  }, [currentJob, audioUrl, getAudioUrl, onAudioReady]);

  // Não mostrar se não há job ativo
  if (!currentJob || !isProcessing) {
    return null;
  }

  const handlePlayAudio = () => {
    if (audioUrl) {
      // Criar elemento de áudio e reproduzir
      const audio = new Audio(audioUrl);
      audio.play().catch((error) => {
        console.error('Erro ao reproduzir áudio:', error);
        toast({
          title: 'Erro ao Reproduzir',
          description: 'Não foi possível reproduzir o áudio. Tente novamente.',
          variant: 'destructive',
        });
      });
    }
  };

  const handleDownloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `autocura-${currentJob.id}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusText = () => {
    if (currentJob.status === 'completed') {
      return '🎉 Sua autocura está pronta!';
    }
    if (currentJob.status === 'processing') {
      return `🔄 Preparando sua autocura... (${currentJob.progress_percentage || 0}%)`;
    }
    if (currentJob.status === 'failed') {
      return '❌ Erro na preparação';
    }
    return '⏳ Iniciando...';
  };

  const getEstimatedTimeRemaining = () => {
    if (currentJob.status === 'completed') return null;
    
    const progress = currentJob.progress_percentage || 0;
    if (progress === 0) return null;
    
    const elapsed = Date.now() - new Date(currentJob.created_at).getTime();
    const totalEstimated = elapsed / (progress / 100);
    const remaining = totalEstimated - elapsed;
    
    return Math.max(0, Math.ceil(remaining / 60000)); // em minutos
  };

  const timeRemaining = getEstimatedTimeRemaining();

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h4 className="font-medium text-sm">{getStatusText()}</h4>
            {timeRemaining && (
              <p className="text-xs text-muted-foreground">
                Tempo restante: ~{timeRemaining} min
              </p>
            )}
          </div>
        </div>

        {currentJob.status === 'processing' && (
          <Progress 
            value={currentJob.progress_percentage || 0} 
            className="w-full h-2"
          />
        )}

        {currentJob.status === 'completed' && audioUrl && (
          <div className="flex gap-2">
            <Button
              onClick={handlePlayAudio}
              size="sm"
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Ouvir Agora
            </Button>
            <Button
              onClick={handleDownloadAudio}
              size="sm"
              variant="outline"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}

        {currentJob.status === 'failed' && (
          <p className="text-xs text-destructive">
            {currentJob.error_message || 'Erro desconhecido na preparação da autocura.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};