import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Download, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAudioAssembly } from '@/hooks/useAudioAssembly';

interface AudioAssemblyProgressProps {
  jobId?: string;
  onComplete?: (audioUrl: string) => void;
  onError?: (error: string) => void;
}

export const AudioAssemblyProgress = ({ jobId, onComplete, onError }: AudioAssemblyProgressProps) => {
  const { currentJob, getJobStatus, getAudioUrl } = useAudioAssembly();

  useEffect(() => {
    if (jobId && !currentJob) {
      getJobStatus(jobId).catch(error => {
        console.error('Failed to fetch job status:', error);
        onError?.(error.message);
      });
    }
  }, [jobId, currentJob, getJobStatus, onError]);

  useEffect(() => {
    if (currentJob?.status === 'completed' && currentJob.result_audio_path) {
      getAudioUrl(currentJob.result_audio_path)
        .then(url => {
          if (url) onComplete?.(url);
        })
        .catch(error => {
          console.error('Failed to get audio URL:', error);
          onError?.(error.message);
        });
    } else if (currentJob?.status === 'failed') {
      onError?.(currentJob.error_message || 'Falha na montagem de áudio');
    }
  }, [currentJob, getAudioUrl, onComplete, onError]);

  if (!currentJob) {
    return null;
  }

  const getStatusColor = () => {
    switch (currentJob.status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (currentJob.status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'processing': return <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />;
      default: return <div className="h-5 w-5 rounded-full bg-gray-300" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Calculando...';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePlayAudio = async () => {
    if (currentJob.result_audio_path) {
      try {
        const audioUrl = await getAudioUrl(currentJob.result_audio_path);
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.play();
        }
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const handleDownloadAudio = async () => {
    if (currentJob.result_audio_path) {
      try {
        const audioUrl = await getAudioUrl(currentJob.result_audio_path);
        if (audioUrl) {
          const link = document.createElement('a');
          link.href = audioUrl;
          link.download = `quantum-audio-${currentJob.id}.mp3`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        console.error('Error downloading audio:', error);
      }
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          <span className={getStatusColor()}>
            {currentJob.status === 'pending' && 'Aguardando Processamento'}
            {currentJob.status === 'processing' && 'Montando Áudio'}
            {currentJob.status === 'completed' && 'Áudio Pronto'}
            {currentJob.status === 'failed' && 'Erro na Montagem'}
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progresso</span>
            <span>{currentJob.progress_percentage}%</span>
          </div>
          <Progress value={currentJob.progress_percentage} className="h-2" />
        </div>

        {/* Duration Info */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Duração:</span>
          <span className="font-medium">
            {formatDuration(currentJob.total_duration_seconds)}
          </span>
        </div>

        {/* Error Message */}
        {currentJob.status === 'failed' && currentJob.error_message && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{currentJob.error_message}</p>
          </div>
        )}

        {/* Action Buttons */}
        {currentJob.status === 'completed' && (
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handlePlayAudio}
              variant="outline" 
              size="sm"
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Reproduzir
            </Button>
            <Button 
              onClick={handleDownloadAudio}
              variant="outline" 
              size="sm"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};