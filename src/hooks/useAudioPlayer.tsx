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

      // Buscar áudios da biblioteca do usuário
      const { data: libraryItems, error: libraryError } = await supabase
        .from("user_audio_library")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
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

      // Combinar e formatar itens
      const formattedItems: AudioItem[] = [
        ...libraryItems.map(item => ({
          id: item.id,
          title: `${item.component_type || 'Áudio'} - ${item.sentiment_name || 'Personalizado'}`,
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

  const getAudioUrl = async (audioPath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from("audio-assembly")
        .createSignedUrl(audioPath, 3600); // 1 hora

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error("Erro ao obter URL do áudio:", error);
      return null;
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