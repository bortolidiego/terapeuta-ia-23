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

  // FASE 2: getAudioUrl com cache inteligente e validação
  const getAudioUrl = async (audioPath: string): Promise<string | undefined> => {
    try {
      console.log('🎵 [getAudioUrl] Requesting URL for path:', audioPath);
      
      // Verificar cache primeiro
      const cached = urlCache.get(audioPath);
      const now = Date.now();
      
      if (cached && cached.expiresAt > now) {
        console.log('🎵 [getAudioUrl] Using cached URL');
        
        // Verificar se a URL ainda é válida
        try {
          const response = await fetch(cached.url, { method: 'HEAD' });
          if (response.ok) {
            return cached.url;
          } else {
            console.log('🎵 [getAudioUrl] Cached URL expired, removing from cache');
            urlCache.delete(audioPath);
          }
        } catch (fetchError) {
          console.log('🎵 [getAudioUrl] Cached URL invalid, removing from cache');
          urlCache.delete(audioPath);
        }
      }
      
      // Gerar nova URL se cache expirou ou não existe
      const { data, error } = await supabase.storage
        .from('audio-assembly')
        .createSignedUrl(audioPath, 7200); // 2 horas
      
      if (error) {
        console.error('🎵 [getAudioUrl] Error generating URL:', error);
        toast({
          title: "Erro",
          description: `Não foi possível acessar o áudio: ${error.message}`,
          variant: "destructive",
        });
        return undefined;
      }
      
      if (!data?.signedUrl) {
        console.error('🎵 [getAudioUrl] URL assinada não retornada');
        return undefined;
      }
      
      // Testar a URL antes de armazenar no cache
      try {
        const testResponse = await fetch(data.signedUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
          console.error('🎵 [getAudioUrl] URL gerada não é acessível');
          return undefined;
        }
        
        // Verificar Content-Type
        const contentType = testResponse.headers.get('content-type');
        if (!contentType?.startsWith('audio/')) {
          console.error('🎵 [getAudioUrl] Arquivo não é um áudio válido:', contentType);
          return undefined;
        }
        
        console.log('🎵 [getAudioUrl] URL validada, Content-Type:', contentType);
      } catch (testError) {
        console.error('🎵 [getAudioUrl] Erro ao testar URL:', testError);
        return undefined;
      }
      
      // Armazenar no cache (expira 1.5 horas antes do limite de 2 horas)
      urlCache.set(audioPath, {
        url: data.signedUrl,
        expiresAt: now + (90 * 60 * 1000) // 1.5 horas
      });
      
      console.log('🎵 [getAudioUrl] URL generated, tested and cached successfully');
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
          const error = e.target?.error;
          console.error('🎵 Erro no audio element:', error);
          
          let errorMessage = "O arquivo de áudio está corrompido ou inacessível.";
          
          // Diagnóstico específico do erro
          if (error) {
            switch (error.code) {
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = "Formato de áudio não suportado. Tentando regenerar...";
                break;
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = "Erro de rede. Verifique sua conexão.";
                break;
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = "Arquivo corrompido. Regenerando áudio...";
                break;
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = "Reprodução cancelada.";
                break;
              default:
                errorMessage = `Erro desconhecido (${error.code}). Cache limpo, tente novamente.`;
            }
          }
          
          // Limpar cache para este arquivo
          urlCache.delete(item.audioPath);
          setIsPlaying(false);
          setCurrentAudio(null);
          
          toast({
            title: "Erro de reprodução",
            description: errorMessage,
            variant: "destructive",
          });
        });
        
        audioRef.current.addEventListener('canplay', () => {
          console.log('🎵 Áudio pronto para reprodução:', item.title);
        });
        
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          console.log('🎵 Reprodução iniciada com sucesso!');
        } catch (playError) {
          console.error('🎵 Erro ao iniciar reprodução:', playError);
          toast({
            title: "Erro de reprodução",
            description: "Não foi possível iniciar a reprodução. Verifique sua conexão.",
            variant: "destructive",
          });
        }
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