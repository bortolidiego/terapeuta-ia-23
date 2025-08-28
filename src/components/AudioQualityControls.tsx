// FASE 4: Controles Avançados de Qualidade de Áudio
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Volume2, 
  Zap, 
  RotateCcw,
  Play,
  Pause,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioQualityControlsProps {
  currentAudio?: any;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
  className?: string;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export const AudioQualityControls = ({ 
  currentAudio, 
  isPlaying, 
  onPlayPause, 
  onSeek,
  onSpeedChange,
  className 
}: AudioQualityControlsProps) => {
  const { toast } = useToast();
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.3,
    use_speaker_boost: true
  });

  const speedPresets = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    onSpeedChange?.(speed);
    toast({
      title: "Velocidade alterada",
      description: `Reprodução ajustada para ${speed}x`,
    });
  };

  const handleVoiceSettingChange = (setting: keyof VoiceSettings, value: number | boolean) => {
    setVoiceSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const regenerateSegment = async () => {
    toast({
      title: "Regenerando Segmento",
      description: "Aplicando novas configurações de voz...",
    });
    // Implementação da regeneração seria feita aqui
  };

  const resetToDefaults = () => {
    setPlaybackSpeed(1);
    setPitch(0);
    setVoiceSettings({
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.3,
      use_speaker_boost: true
    });
    onSpeedChange?.(1);
    toast({
      title: "Configurações resetadas",
      description: "Todos os valores foram restaurados ao padrão",
    });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Controles de Qualidade
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Controles de Reprodução Avançados */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Reprodução</h4>
          
          {/* Velocidade */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Velocidade</span>
              <Badge variant="outline">{playbackSpeed}x</Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              {speedPresets.map(speed => (
                <Button
                  key={speed}
                  variant={playbackSpeed === speed ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSpeedChange(speed)}
                  className="text-xs"
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </div>

          {/* Controle de Tom */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Tom (Pitch)</span>
              <span className="text-xs text-muted-foreground">
                {pitch > 0 ? `+${pitch}` : pitch} semitons
              </span>
            </div>
            <Slider
              value={[pitch]}
              onValueChange={([value]) => setPitch(value)}
              min={-12}
              max={12}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        <Separator />

        {/* Configurações de Voz */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Configurações de Voz</h4>
          
          {/* Estabilidade */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Estabilidade</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(voiceSettings.stability * 100)}%
              </span>
            </div>
            <Slider
              value={[voiceSettings.stability]}
              onValueChange={([value]) => handleVoiceSettingChange('stability', value)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Mais baixo = mais variado, Mais alto = mais consistente
            </p>
          </div>

          {/* Similaridade */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Boost de Similaridade</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(voiceSettings.similarity_boost * 100)}%
              </span>
            </div>
            <Slider
              value={[voiceSettings.similarity_boost]}
              onValueChange={([value]) => handleVoiceSettingChange('similarity_boost', value)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Aumenta a semelhança com a voz original
            </p>
          </div>

          {/* Estilo */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Estilo</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(voiceSettings.style * 100)}%
              </span>
            </div>
            <Slider
              value={[voiceSettings.style]}
              onValueChange={([value]) => handleVoiceSettingChange('style', value)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Controla a expressividade da voz
            </p>
          </div>
        </div>

        <Separator />

        {/* Ações */}
        <div className="flex gap-2">
          <Button 
            onClick={regenerateSegment}
            size="sm"
            className="flex-1"
            disabled={!currentAudio}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Regerar
          </Button>
          
          <Button 
            onClick={resetToDefaults}
            variant="outline"
            size="sm"
          >
            <Zap className="h-4 w-4" />
          </Button>
        </div>

        {/* Presets de Qualidade */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Presets</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVoiceSettings({
                  stability: 0.7,
                  similarity_boost: 0.9,
                  style: 0.2,
                  use_speaker_boost: true
                });
              }}
            >
              Profissional
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVoiceSettings({
                  stability: 0.3,
                  similarity_boost: 0.6,
                  style: 0.6,
                  use_speaker_boost: true
                });
              }}
            >
              Expressivo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};