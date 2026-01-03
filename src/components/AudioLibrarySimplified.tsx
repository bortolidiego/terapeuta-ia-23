import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
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
  RefreshCw,
  ChevronLeft,
  ChevronRight
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
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">
            {item.type === 'sentiment' ? item.componentKey : item.text}
          </p>
          {item.status === 'completed' && item.generationMethod && (
            <Badge
              variant={item.generationMethod === 'ai' ? 'secondary' : 'outline'}
              className={`text-[10px] px-1 h-4 ml-2 uppercase ${item.generationMethod === 'manual' ? 'border-primary text-primary' : ''}`}
            >
              {item.generationMethod}
            </Badge>
          )}
        </div>

        {/* Compact action buttons */}
        <div className="flex gap-2">
          {item.status === 'completed' && item.audioPath && (
            <>
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
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    await onGenerate(item);
                  } catch (err) {
                    console.error('Error regenerating:', err);
                  }
                }}
                title="Reclonar com IA"
              >
                <Bot className="w-4 h-4" />
              </Button>
            </>
          )}

          {item.status === 'pending' && (
            <Button
              size="sm"
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  // console.log('Cloning item:', item.componentKey);
                  await onGenerate(item);
                } catch (err) {
                  console.error('Error on click:', err);
                }
              }}
              className="flex-1 h-7 text-xs"
            >
              Clonar
            </Button>
          )}

          {item.status === 'processing' && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled
              className="flex-1"
            >
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Clonando...
            </Button>
          )}

          {(item.status === 'error' || item.status === 'failed') && (
            <Button
              size="sm"
              type="button"
              variant="destructive"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await onGenerate(item);
                } catch (err) {
                  console.error(err);
                }
              }}
              className="flex-1 h-7 text-xs"
            >
              Tentar Novamente
            </Button>
          )}

          <Button
            size="sm"
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            onClick={() => onRecord(item)}
            className={isRecording ? "animate-pulse" : ""}
          >
            {isRecording ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const AudioLibrarySimplified = () => {
  const [selectedTab, setSelectedTab] = useState<'base_words' | 'sentiments'>('base_words');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const {
    baseWords,
    sentiments,
    isLoading,
    isGenerating,
    stats,
    loadLibrary,
    generateAudio,
    generateBatch,
    saveManualAudio
  } = useAudioLibrary();

  const { currentAudio, isPlaying, playAudio, pause, resume } = useAudioPlayer();
  const { isRecording, startRecording, stopRecording, stopRecordingBlob } = useVoiceRecording();
  const [recordingItemId, setRecordingItemId] = useState<string | null>(null);

  // Audio element for library playback (separate from useAudioPlayer which uses different bucket)
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [libraryPlaying, setLibraryPlaying] = useState<string | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (!libraryAudioRef.current) {
      libraryAudioRef.current = new Audio();
      libraryAudioRef.current.addEventListener('ended', () => setLibraryPlaying(null));
      libraryAudioRef.current.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setLibraryPlaying(null);
      });
    }
    return () => {
      if (libraryAudioRef.current) {
        libraryAudioRef.current.pause();
        libraryAudioRef.current = null;
      }
    };
  }, []);

  // Store current item being played for trim checking
  const currentPlayingItemRef = useRef<AudioLibraryItem | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const handlePlayAudio = async (item: AudioLibraryItem) => {
    if (!item.audioPath) return;

    // Clean up any existing RAF
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Toggle pause/play for same item
    if (libraryPlaying === item.id) {
      if (libraryAudioRef.current) {
        libraryAudioRef.current.pause();
        setLibraryPlaying(null);
        currentPlayingItemRef.current = null;
      }
      return;
    }

    // Get public URL from audio-library bucket
    const { data } = supabase.storage
      .from('audio-library')
      .getPublicUrl(item.audioPath);

    if (!data?.publicUrl) {
      console.error('Could not get public URL');
      return;
    }

    // Setup high-precision trim checking if applicable
    if (item.trimEndTime && libraryAudioRef.current) {
      // Use the exact trim time from backend (which already has a small decay buffer)
      const trimTime = item.trimEndTime;
      currentPlayingItemRef.current = item;

      console.log(`Setting up high-precision trim for ${item.componentKey} at ${trimTime}s (original: ${item.trimEndTime}s)`);

      const checkTrim = () => {
        if (!libraryAudioRef.current || currentPlayingItemRef.current?.id !== item.id) {
          return;
        }

        if (libraryAudioRef.current.currentTime >= trimTime) {
          console.log(`Precise trim point reached at ${libraryAudioRef.current.currentTime}s, stopping`);
          libraryAudioRef.current.pause();
          libraryAudioRef.current.currentTime = 0;
          setLibraryPlaying(null);
          currentPlayingItemRef.current = null;
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
        } else {
          rafIdRef.current = requestAnimationFrame(checkTrim);
        }
      };

      rafIdRef.current = requestAnimationFrame(checkTrim);
    }

    // Play the audio
    if (libraryAudioRef.current) {
      libraryAudioRef.current.src = data.publicUrl;
      try {
        await libraryAudioRef.current.play();
        setLibraryPlaying(item.id);
      } catch (error) {
        console.error('Playback error:', error);
        setLibraryPlaying(null);
        currentPlayingItemRef.current = null;
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      }
    }
  };

  const handleRecord = async (item: AudioLibraryItem) => {
    try {
      if (isRecording) {
        if (recordingItemId !== item.id) return; // Ignore if recording someone else

        const blob = await stopRecordingBlob();
        await saveManualAudio(item, blob);
        setRecordingItemId(null);
      } else {
        await startRecording();
        setRecordingItemId(item.id);
      }
    } catch (error: any) {
      console.error('Recording error:', error);
      setRecordingItemId(null);
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

  // Pagination
  const totalPages = Math.ceil(currentItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = currentItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblioteca de Áudios</CardTitle>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4">
          <Button
            variant={selectedTab === 'base_words' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedTab('base_words');
              setCurrentPage(1);
            }}
          >
            Blocos ({stats.baseWords.completed}/{stats.baseWords.total})
          </Button>
          <Button
            variant={selectedTab === 'sentiments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedTab('sentiments');
              setCurrentPage(1);
            }}
          >
            Sentimentos ({stats.sentiments.completed}/{stats.sentiments.total})
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
            onClick={() => loadLibrary()}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>

          {!isGenerating ? (
            <Button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await generateBatch(selectedTab);
                } catch (err) {
                  console.error(err);
                }
              }}
              disabled={isGenerating}
              className="flex-1"
            >
              Clonar Todos - {selectedTab === 'base_words' ? 'Blocos' : 'Sentimentos'}
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
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {paginatedItems.map((item) => (
              <AudioItemCard
                key={item.id}
                item={item}
                currentAudio={libraryPlaying ? { id: libraryPlaying } : null}
                isPlaying={libraryPlaying === item.id}
                isRecording={isRecording && recordingItemId === item.id}
                onPlay={handlePlayAudio}
                onGenerate={generateAudio}
                onRecord={handleRecord}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>

            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};