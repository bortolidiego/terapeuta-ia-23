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

  const getAudioUrl = async (audioPath: string): Promise<string | null> => {
    try {
      if (!audioPath) {
        console.error("Caminho do áudio não fornecido");
        return null;
      }

      console.log("🔍 Tentando obter URL para:", audioPath);

      // Determinar bucket correto baseado no path
      let bucket = "audio-assembly";
      let fullPath = audioPath;

      // Se o path contém user-audio-library, é um áudio da biblioteca
      if (audioPath.includes("user-audio-library/")) {
        bucket = "audio-assembly";
        fullPath = audioPath;
      } 
      // Se é apenas userId/filename, assumir que é do audio-drafts
      else if (audioPath.match(/^[a-f0-9-]+\/[^/]+\.(mp3|wav|m4a)$/)) {
        bucket = "audio-drafts";
        fullPath = audioPath;
      }
      // Se não tem estrutura de diretório, tentar adicionar prefixo
      else if (!audioPath.includes("/")) {
        // Tentar primeiro como audio-assembly
        bucket = "audio-assembly";
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          fullPath = `user-audio-library/${user.id}/${audioPath}`;
        }
      }

      console.log(`🎯 Tentando bucket: ${bucket}, path: ${fullPath}`);

      // Tentar obter URL do bucket determinado
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fullPath, 3600);

      if (error) {
        console.error(`Erro no bucket ${bucket}:`, error);
        
        // Fallback: tentar outros buckets
        const fallbackBucket = bucket === "audio-assembly" ? "audio-drafts" : "audio-assembly";
        console.log(`🔄 Tentando fallback no bucket: ${fallbackBucket}`);
        
        const { data: altData, error: altError } = await supabase.storage
          .from(fallbackBucket)
          .createSignedUrl(audioPath, 3600);
        
        if (altError) {
          console.error("Erro também no bucket alternativo:", altError);
          throw altError;
        }
        
        console.log("✅ URL obtida via fallback:", altData.signedUrl);
        return altData.signedUrl;
      }

      console.log("✅ URL obtida com sucesso:", data.signedUrl);
      return data.signedUrl;
    } catch (error) {
      console.error("Erro ao obter URL do áudio:", error);
      toast({
        title: "Erro no áudio",
        description: `Arquivo não encontrado: ${audioPath.split('/').pop()}`,
        variant: "destructive",
      });
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