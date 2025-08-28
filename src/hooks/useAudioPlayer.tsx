import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface AudioItem {
  id: string;
  title: string;
  duration: number;
  audioPath: string;
  createdAt: string;
  sessionId?: string;
  componentType?: string;
}

// FASE 2: Cache inteligente de URLs
interface UrlCache {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, UrlCache>();

export const useAudioPlayer = () => {
  const [currentAudio, setCurrentAudio] = useState<AudioItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioItems, setAudioItems] = useState<AudioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAudioItems();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration);
      const handleEnded = () => setIsPlaying(false);
      
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [currentAudio]);

  const loadAudioItems = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar áudios da biblioteca do usuário (apenas o mais recente de cada component_key)
      const { data: libraryItems, error: libraryError } = await supabase
        .from("user_audio_library")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("component_key", { ascending: true })
        .order("created_at", { ascending: false });

      if (libraryError) throw libraryError;

      // Buscar jobs de assembly concluídos
      const { data: assemblyJobs, error: assemblyError } = await supabase
        .from("assembly_jobs")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (assemblyError) throw assemblyError;

      // Filtrar duplicatas (manter apenas o mais recente por component_key)
      const uniqueLibraryItems = libraryItems?.reduce((acc: any[], item: any) => {
        const existing = acc.find(i => i.component_key === item.component_key);
        if (!existing) {
          acc.push(item);
        }
        return acc;
      }, []) || [];

      // Combinar e formatar itens
      const formattedItems: AudioItem[] = [
        ...uniqueLibraryItems.map(item => ({
          id: item.id,
          title: `${item.component_type || 'Áudio'} - ${item.sentiment_name || item.component_key}`,
          duration: 0, // Will be loaded when playing
          audioPath: item.audio_path,
          createdAt: item.created_at,
          componentType: item.component_type
        })),
        ...assemblyJobs.map(job => ({
          id: job.id,
          title: `Sessão de Auto-Cura`,
          duration: job.total_duration_seconds || 0,
          audioPath: job.result_audio_path,
          createdAt: job.created_at,
          sessionId: job.session_id
        }))
      ];

      setAudioItems(formattedItems);
    } catch (error) {
      console.error("Erro ao carregar áudios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus áudios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // FASE 2: getAudioUrl com cache inteligente
  const getAudioUrl = async (audioPath: string): Promise<string | undefined> => {
    try {
      console.log('🎵 [getAudioUrl] Requesting URL for path:', audioPath);
      
      // Verificar cache primeiro
      const cached = urlCache.get(audioPath);
      const now = Date.now();
      
      if (cached && cached.expiresAt > now) {
        console.log('🎵 [getAudioUrl] Using cached URL');
        return cached.url;
      }
      
      // Gerar nova URL se cache expirou ou não existe
      const { data, error } = await supabase.storage
        .from('audio-assembly')
        .createSignedUrl(audioPath, 3600); // 1 hora
      
      if (error) {
        console.error('🎵 [getAudioUrl] Error generating URL:', error);
        toast({
          title: "Erro",
          description: `Não foi possível acessar o áudio: ${error.message}`,
          variant: "destructive",
        });
        return undefined;
      }
      
      // Armazenar no cache (expira 50 minutos antes do limite de 1 hora)
      urlCache.set(audioPath, {
        url: data.signedUrl,
        expiresAt: now + (50 * 60 * 1000) // 50 minutos
      });
      
      console.log('🎵 [getAudioUrl] URL generated and cached successfully');
      return data.signedUrl;
      
    } catch (error: any) {
      console.error('🎵 [getAudioUrl] Unexpected error:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar áudio",
        variant: "destructive",
      });
      return undefined;
    }
  };

  const playAudio = async (item: AudioItem) => {
    try {
      if (currentAudio?.id === item.id && isPlaying) {
        pause();
        return;
      }

      const audioUrl = await getAudioUrl(item.audioPath);
      if (!audioUrl) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar o áudio",
          variant: "destructive",
        });
        return;
      }

      setCurrentAudio(item);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.volume = volume;
        
        // Adicionar event listeners para debug
        audioRef.current.addEventListener('loadstart', () => {
          console.log('Carregamento iniciado:', audioUrl);
        });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error('Erro no audio element:', e);
          toast({
            title: "Erro de reprodução",
            description: "O arquivo de áudio não pôde ser carregado",
            variant: "destructive",
          });
        });
        
        audioRef.current.addEventListener('canplay', () => {
          console.log('Áudio pronto para reprodução');
        });
        
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Erro ao reproduzir áudio:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reproduzir o áudio",
        variant: "destructive",
      });
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const changeVolume = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const downloadAudio = async (item: AudioItem) => {
    try {
      const audioUrl = await getAudioUrl(item.audioPath);
      if (!audioUrl) return;

      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `${item.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download iniciado",
        description: "O áudio está sendo baixado",
      });
    } catch (error) {
      console.error("Erro ao baixar áudio:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o áudio",
        variant: "destructive",
      });
    }
  };

  return {
    // Estado
    currentAudio,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioItems,
    isLoading,
    audioRef,
    
    // Ações
    playAudio,
    pause,
    resume,
    seek,
    changeVolume,
    downloadAudio,
    loadAudioItems,
  };
};