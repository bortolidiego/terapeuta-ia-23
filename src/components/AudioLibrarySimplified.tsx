import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useAudioLibrary, AudioLibraryItem } from "@/hooks/useAudioLibrary";
import { 
  Play, 
  Pause, 
  Bot, 
  Mic, 
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Square,
  RefreshCw
} from 'lucide-react';

interface AudioItemCardProps {
  item: AudioLibraryItem;
  currentAudio?: any;
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: (item: AudioLibraryItem) => void;
  onGenerate: (item: AudioLibraryItem) => void;
  onRecord: (item: AudioLibraryItem) => void;
}

const AudioItemCard: React.FC<AudioItemCardProps> = ({
  item,
  currentAudio,
  isPlaying,
  isRecording,
  onPlay,
  onGenerate,
  onRecord
}) => {
  const getStatusIcon = () => {
    switch (item.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (item.status) {
      case 'completed': return 'border-green-200 bg-green-50/50';
      case 'processing': return 'border-blue-200 bg-blue-50/50';
      case 'error': return 'border-red-200 bg-red-50/50';
      default: return 'border-border bg-card';
    }
  };

  const isCurrentlyPlaying = currentAudio?.id === item.id && isPlaying;

  return (
    <Card className={`transition-colors ${getStatusColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant="outline" className="text-xs">
              {item.componentKey}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {item.type === 'base_word' ? '📝' : '💭'}
          </div>
        </div>
        
        <p className="text-sm mb-4 text-foreground">{item.text}</p>
        
        <div className="flex gap-2">
          {item.status === 'completed' && item.audioPath && (
            <Button
              size="sm"
              variant={isCurrentlyPlaying ? "default" : "outline"}
              onClick={() => onPlay(item)}
              className="flex-1"
            >
              {isCurrentlyPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          )}
          
          {item.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => onGenerate(item)}
              className="flex-1"
            >
              <Bot className="w-4 h-4 mr-1" />
              Gerar
            </Button>
          )}
          
          {item.status === 'processing' && (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="flex-1"
            >
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Gerando...
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRecord(item)}
            disabled={isRecording}
          >
            <Mic className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const AudioLibrarySimplified = () => {
  const [selectedTab, setSelectedTab] = useState<'base_words' | 'sentiments'>('base_words');
  
  const { 
    baseWords, 
    sentiments, 
    isLoading, 
    isGenerating, 
    stats, 
    loadLibrary, 
    generateAudio, 
    generateBatch 
  } = useAudioLibrary();
  
  const { currentAudio, isPlaying, playAudio, pause, resume } = useAudioPlayer();
  const { isRecording, startRecording, stopRecording } = useVoiceRecording();

  const handlePlayAudio = async (item: AudioLibraryItem) => {
    if (!item.audioPath) return;

    if (currentAudio?.id === item.id && isPlaying) {
      pause();
    } else if (currentAudio?.id === item.id && !isPlaying) {
      resume();
    } else {
      await playAudio({
        id: item.id,
        title: item.componentKey,
        audioPath: item.audioPath,
        duration: 0,
        createdAt: item.createdAt
      });
    }
  };

  const handleRecord = async (item: AudioLibraryItem) => {
    try {
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    } catch (error: any) {
      console.error('Recording error:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Biblioteca de Áudios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentItems = selectedTab === 'base_words' ? baseWords : sentiments;
  const currentStats = selectedTab === 'base_words' ? stats.baseWords : stats.sentiments;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblioteca de Áudios</CardTitle>
        
        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4">
          <Button
            variant={selectedTab === 'base_words' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('base_words')}
          >
            📝 Palavras Base ({stats.baseWords.completed}/{stats.baseWords.total})
          </Button>
          <Button
            variant={selectedTab === 'sentiments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('sentiments')}
          >
            💭 Sentimentos ({stats.sentiments.completed}/{stats.sentiments.total})
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Stats Section */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Progresso: {currentStats.progress}%</span>
            <Badge variant="outline">
              {currentStats.completed} de {currentStats.total} completos
            </Badge>
          </div>
          <Progress value={currentStats.progress} className="h-2" />
          
          {currentStats.processing > 0 && (
            <div className="text-sm text-blue-600">
              {currentStats.processing} áudios sendo processados...
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLibrary}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          
          {!isGenerating ? (
            <Button
              onClick={() => generateBatch(selectedTab)}
              disabled={isGenerating}
              className="flex-1"
            >
              <Bot className="w-4 h-4 mr-2" />
              Gerar {selectedTab === 'base_words' ? 'Palavras Base' : 'Sentimentos'}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-2" />
              Parar Geração
            </Button>
          )}
        </div>

        <Separator className="mb-6" />

        {/* Audio Items Grid */}
        {currentItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum item encontrado
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentItems.map((item) => (
              <AudioItemCard
                key={item.id}
                item={item}
                currentAudio={currentAudio}
                isPlaying={isPlaying}
                isRecording={isRecording}
                onPlay={handlePlayAudio}
                onGenerate={generateAudio}
                onRecord={handleRecord}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};