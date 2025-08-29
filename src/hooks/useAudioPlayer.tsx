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

      // CORREÇÃO: Buscar APENAS jobs de assembly concluídos (Sessões de Auto-Cura)
      const { data: assemblyJobs, error: assemblyError } = await supabase
        .from("assembly_jobs")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("result_audio_path", "is", null) // Garantir que o arquivo existe
        .order("created_at", { ascending: false });

      if (assemblyError) throw assemblyError;

      // Formatar apenas os assembly jobs como áudios de consulta
      const formattedItems: AudioItem[] = assemblyJobs?.map(job => ({
        id: job.id,
        title: `Sessão de Auto-Cura - ${new Date(job.created_at).toLocaleDateString('pt-BR')}`,
        duration: job.total_duration_seconds || 0,
        audioPath: job.result_audio_path,
        createdAt: job.created_at,
        sessionId: job.session_id
      })) || [];

      setAudioItems(formattedItems);
    } catch (error) {
      console.error("Erro ao carregar áudios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas sessões de auto-cura",
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

      console.log('🎵 [playAudio] Iniciando reprodução:', item.title, 'Path:', item.audioPath);

      // CORREÇÃO: Verificar se o arquivo existe antes de tentar reproduzir
      if (!item.audioPath) {
        console.error('🎵 [playAudio] audioPath está vazio para item:', item.id);
        toast({
          title: "Erro",
          description: "Arquivo de áudio não encontrado para esta sessão",
          variant: "destructive",
        });
        return;
      }

      // Verificar se o arquivo existe no storage antes de gerar URL
      const { data: fileExists, error: checkError } = await supabase.storage
        .from('audio-assembly')
        .list(item.audioPath.split('/').slice(0, -1).join('/'));

      if (checkError) {
        console.error('🎵 [playAudio] Erro ao verificar arquivo:', checkError);
        toast({
          title: "Erro de acesso",
          description: "Não foi possível verificar o arquivo. Verifique suas permissões.",
          variant: "destructive",
        });
        return;
      }

      const fileName = item.audioPath.split('/').pop();
      const fileFound = fileExists?.some(file => file.name === fileName);
      
      if (!fileFound) {
        console.error('🎵 [playAudio] Arquivo não encontrado no storage:', item.audioPath);
        toast({
          title: "Arquivo não encontrado",
          description: "O arquivo de áudio foi removido ou está em processamento. Tente gerar novamente.",
          variant: "destructive",
        });
        return;
      }

      const audioUrl = await getAudioUrl(item.audioPath);
      if (!audioUrl) {
        console.error('🎵 [playAudio] Falha ao obter URL para:', item.audioPath);
        toast({
          title: "Erro",
          description: "Não foi possível acessar o arquivo de áudio. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      console.log('🎵 [playAudio] URL obtida com sucesso, iniciando reprodução...');
      setCurrentAudio(item);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.volume = volume;
        
        // Event listeners para melhor tratamento de erros
        audioRef.current.addEventListener('loadstart', () => {
          console.log('🎵 Carregamento iniciado:', item.title);
        });
        
        audioRef.current.addEventListener('error', (e: any) => {
          console.error('🎵 Erro no audio element:', e);
          toast({
            title: "Erro de reprodução",
            description: "O arquivo de áudio está corrompido ou inacessível",
            variant: "destructive",
          });
        });
        
        audioRef.current.addEventListener('canplay', () => {
          console.log('🎵 Áudio pronto para reprodução:', item.title);
        });
        
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("🎵 Erro ao reproduzir áudio:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reproduzir esta sessão de auto-cura",
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