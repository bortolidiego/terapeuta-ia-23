import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  VolumeX,
  Music,
  Calendar,
  Clock,
  Settings,
  Activity
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAudioPlayer, AudioItem } from "@/hooks/useAudioPlayer";
import { AudioAssemblyProgress } from "./AudioAssemblyProgress";
import { AudioQualityControls } from "./AudioQualityControls";

interface AudioPlayerProps {
  className?: string;
}

export const AudioPlayer = ({ className }: AudioPlayerProps) => {
  const {
    currentAudio,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioItems,
    isLoading,
    audioRef,
    playAudio,
    pause,
    resume,
    seek,
    changeVolume,
    downloadAudio,
  } = useAudioPlayer();

  const [isMuted, setIsMuted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const filteredAudioItems = audioItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleMute = () => {
    if (isMuted) {
      changeVolume(0.7);
      setIsMuted(false);
    } else {
      changeVolume(0);
      setIsMuted(true);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (audioItems.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Music className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-foreground">Nenhum áudio disponível</h3>
              <p className="text-sm text-muted-foreground">
                Complete algumas sessões para gerar seus áudios de auto-cura personalizados
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <Tabs defaultValue="player" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="player" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Player
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Progresso
            </TabsTrigger>
            <TabsTrigger value="controls" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Qualidade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="space-y-6 mt-6">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Seus Áudios de Auto-Cura</h2>
              <p className="text-sm text-muted-foreground">
                Reproduza e baixe seus áudios personalizados criados durante as sessões
              </p>
            </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar áudios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Current Playing */}
        {currentAudio && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium text-foreground">{currentAudio.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(currentAudio.createdAt), "d 'de' MMMM, yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadAudio(currentAudio)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Player Controls */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={isPlaying ? pause : resume}
                    className="h-10 w-10 rounded-full"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>

                  <div className="flex-1 space-y-2">
                    <Slider
                      value={[currentTime]}
                      max={duration}
                      step={1}
                      onValueChange={([value]) => seek(value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleMute}
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Slider
                      value={[volume]}
                      max={1}
                      step={0.1}
                      onValueChange={([value]) => changeVolume(value)}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audio List */}
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Biblioteca ({filteredAudioItems.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAudioItems.map((item) => (
              <AudioListItem
                key={item.id}
                item={item}
                isActive={currentAudio?.id === item.id}
                onPlay={() => playAudio(item)}
                onDownload={() => downloadAudio(item)}
              />
            ))}
          </div>
        </div>

            {/* Hidden audio element */}
            <audio ref={audioRef} />
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <AudioAssemblyProgress className="w-full" />
          </TabsContent>

          <TabsContent value="controls" className="mt-6">
            <AudioQualityControls 
              currentAudio={currentAudio}
              isPlaying={isPlaying}
              onPlayPause={isPlaying ? pause : resume}
              onSpeedChange={(speed) => {
                if (audioRef.current) {
                  audioRef.current.playbackRate = speed;
                }
              }}
              className="w-full"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface AudioListItemProps {
  item: AudioItem;
  isActive: boolean;
  onPlay: () => void;
  onDownload: () => void;
}

const AudioListItem = ({ item, isActive, onPlay, onDownload }: AudioListItemProps) => {
  return (
    <Card className={`cursor-pointer transition-colors ${isActive ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPlay}
              className="h-8 w-8 rounded-full"
            >
              <Play className="h-3 w-3" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground truncate">
                {item.title}
              </h4>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(item.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                </div>
                {item.duration > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {item.componentType && (
              <Badge variant="secondary" className="text-xs">
                {item.componentType}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="h-8 w-8"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};