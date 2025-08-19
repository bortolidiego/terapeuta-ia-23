import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { 
  Play, 
  Pause, 
  Volume2,
  VolumeX,
  Bot, 
  Mic, 
  Loader2,
  ChevronLeft, 
  ChevronRight,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Square
} from 'lucide-react';

type FilterType = 'all' | 'generated' | 'pending';
type GenerationType = 'base_words' | 'sentiments';

interface AudioItem {
  id: string;
  key: string;
  text: string;
  status: 'completed' | 'pending' | 'processing' | 'error';
  audioPath?: string;
  type: 'base_word' | 'sentiment';
}

export const AudioLibraryNew = () => {
  const [baseWords, setBaseWords] = useState<AudioItem[]>([]);
  const [sentiments, setSentiments] = useState<AudioItem[]>([]);
  const [userLibrary, setUserLibrary] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros e paginação separados
  const [baseFilter, setBaseFilter] = useState<FilterType>('all');
  const [sentimentFilter, setSentimentFilter] = useState<FilterType>('all');
  const [basePage, setBasePage] = useState(1);
  const [sentimentPage, setSentimentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Estados de geração
  const [generatingBase, setGeneratingBase] = useState(false);
  const [generatingSentiments, setGeneratingSentiments] = useState(false);
  
  const { toast } = useToast();
  const { currentAudio, isPlaying, playAudio, pause, resume } = useAudioPlayer();
  const { isRecording, startRecording, stopRecording, cancelRecording } = useVoiceRecording();

  useEffect(() => {
    loadAudioLibrary();
  }, []);

  const loadAudioLibrary = async () => {
    try {
      setIsLoading(true);

      // Buscar fragmentos base
      const { data: fragments, error: fragmentsError } = await supabase
        .from('audio_components')
        .select('*')
        .eq('protocol_type', 'evento_traumatico_especifico')
        .eq('component_type', 'base_word')
        .order('component_key');

      if (fragmentsError) throw fragmentsError;

      // Buscar sentimentos (top 20 mais usados)
      const { data: sentimentData, error: sentimentsError } = await supabase
        .from('sentimentos')
        .select('*')
        .order('frequencia_uso', { ascending: false })
        .limit(20);

      if (sentimentsError) throw sentimentsError;

      // Buscar biblioteca do usuário
      const { data: library, error: libraryError } = await supabase
        .from('user_audio_library')
        .select('*')
        .order('created_at', { ascending: false });

      if (libraryError) throw libraryError;

      // Mapear fragmentos base
      const mappedBaseWords: AudioItem[] = (fragments || []).map(fragment => ({
        id: fragment.id,
        key: fragment.component_key,
        text: fragment.text_content,
        type: 'base_word' as const,
        status: library?.find(item => 
          item.component_key === fragment.component_key && 
          item.component_type === 'base_word'
        ) ? 'completed' : 'pending',
        audioPath: library?.find(item => 
          item.component_key === fragment.component_key && 
          item.component_type === 'base_word'
        )?.audio_path
      }));

      // Mapear sentimentos
      const mappedSentiments: AudioItem[] = (sentimentData || []).map(sentiment => ({
        id: sentiment.id,
        key: sentiment.nome,
        text: sentiment.contexto || `${sentiment.nome}s que eu senti`,
        type: 'sentiment' as const,
        status: library?.find(item => 
          item.component_key === `sentiment_${sentiment.nome}` && 
          item.component_type === 'sentiment'
        ) ? 'completed' : 'pending',
        audioPath: library?.find(item => 
          item.component_key === `sentiment_${sentiment.nome}` && 
          item.component_type === 'sentiment'
        )?.audio_path
      }));

      setBaseWords(mappedBaseWords);
      setSentiments(mappedSentiments);
      setUserLibrary(library || []);
    } catch (error) {
      console.error('Erro ao carregar biblioteca:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a biblioteca de áudios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAudioBatch = async (type: GenerationType) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      if (type === 'base_words') {
        setGeneratingBase(true);
      } else {
        setGeneratingSentiments(true);
      }

      const sentimentNames = sentiments.map(s => s.key);

      const { data, error } = await supabase.functions.invoke('batch-generate-audio-items', {
        body: {
          sessionId: crypto.randomUUID(),
          userId: session.user.id,
          type,
          sentiments: type === 'sentiments' ? sentimentNames : undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Geração iniciada",
        description: `Geração de ${type === 'base_words' ? 'palavras base' : 'sentimentos'} iniciada. Aguarde a notificação de conclusão.`,
      });

      // Recarregar biblioteca periodicamente
      const interval = setInterval(() => {
        loadAudioLibrary();
      }, 5000);

      // Parar após 5 minutos
      setTimeout(() => {
        clearInterval(interval);
        if (type === 'base_words') setGeneratingBase(false);
        else setGeneratingSentiments(false);
      }, 300000);

    } catch (error: any) {
      console.error('Erro na geração:', error);
      toast({
        title: "Erro na geração",
        description: error.message || "Falha ao iniciar geração",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        if (type === 'base_words') setGeneratingBase(false);
        else setGeneratingSentiments(false);
      }, 2000);
    }
  };

  const stopGeneration = (type: GenerationType) => {
    if (type === 'base_words') {
      setGeneratingBase(false);
    } else {
      setGeneratingSentiments(false);
    }
    
    toast({
      title: "Geração interrompida",
      description: `Geração de ${type === 'base_words' ? 'palavras base' : 'sentimentos'} foi interrompida`,
    });
  };

  const handlePlayAudio = async (item: AudioItem) => {
    if (!item.audioPath) return;

    if (currentAudio?.id === item.id && isPlaying) {
      pause();
    } else if (currentAudio?.id === item.id && !isPlaying) {
      resume();
    } else {
      await playAudio({
        id: item.id,
        title: item.key,
        audioPath: item.audioPath,
        duration: 0,
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleRecord = async (item: AudioItem) => {
    try {
      if (isRecording) {
        const transcription = await stopRecording();
        console.log('Gravação finalizada:', transcription);
        // TODO: Salvar gravação no storage e atualizar biblioteca
        toast({
          title: "Gravação finalizada",
          description: "Sua gravação foi salva com sucesso",
        });
      } else {
        await startRecording();
        toast({
          title: "Gravação iniciada",
          description: `Gravando: "${item.text}"`,
        });
      }
    } catch (error: any) {
      console.error('Erro na gravação:', error);
      toast({
        title: "Erro na gravação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'processing': return 'bg-blue-50 border-blue-200';
      case 'error': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  // Filtrar itens
  const filterItems = (items: AudioItem[], filter: FilterType) => {
    switch (filter) {
      case 'generated':
        return items.filter(item => item.status === 'completed');
      case 'pending':
        return items.filter(item => item.status !== 'completed');
      default:
        return items;
    }
  };

  const filteredBaseWords = filterItems(baseWords, baseFilter);
  const filteredSentiments = filterItems(sentiments, sentimentFilter);

  // Paginação
  const paginateItems = (items: AudioItem[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };

  const paginatedBaseWords = paginateItems(filteredBaseWords, basePage);
  const paginatedSentiments = paginateItems(filteredSentiments, sentimentPage);

  const baseTotalPages = Math.ceil(filteredBaseWords.length / itemsPerPage);
  const sentimentTotalPages = Math.ceil(filteredSentiments.length / itemsPerPage);

  // Calcular progressos
  const baseProgress = baseWords.length > 0 ? 
    Math.round((baseWords.filter(item => item.status === 'completed').length / baseWords.length) * 100) : 0;
  const sentimentProgress = sentiments.length > 0 ? 
    Math.round((sentiments.filter(item => item.status === 'completed').length / sentiments.length) * 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Biblioteca de Áudios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblioteca de Áudios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Palavras Base */}
          <div className="space-y-4">
            {/* Header Palavras Base */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  📝 Palavras Base
                </h3>
                <Badge variant="outline">
                  {baseWords.filter(item => item.status === 'completed').length}/{baseWords.length}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso: {baseProgress}%</span>
                  <span>{baseWords.filter(item => item.status === 'completed').length} geradas</span>
                </div>
                <Progress value={baseProgress} className="h-2" />
              </div>

              <div className="flex items-center gap-2">
                {!generatingBase ? (
                  <Button 
                    onClick={() => generateAudioBatch('base_words')}
                    size="sm"
                    className="flex-1"
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    Gerar Palavras Base
                  </Button>
                ) : (
                  <Button 
                    onClick={() => stopGeneration('base_words')}
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Parar Geração
                  </Button>
                )}
              </div>

              {/* Filtros e Paginação - Base */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(['all', 'generated', 'pending'] as FilterType[]).map((filter) => (
                    <Button
                      key={filter}
                      variant={baseFilter === filter ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBaseFilter(filter);
                        setBasePage(1);
                      }}
                    >
                      {filter === 'all' && 'Todos'}
                      {filter === 'generated' && 'Gerados'}
                      {filter === 'pending' && 'Pendentes'}
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBasePage(Math.max(1, basePage - 1))}
                    disabled={basePage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">
                    {basePage} de {baseTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBasePage(Math.min(baseTotalPages, basePage + 1))}
                    disabled={basePage >= baseTotalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista Palavras Base */}
            <div className="space-y-2">
              {paginatedBaseWords.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-lg border ${getStatusColor(item.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(item.status)}
                        <span className="font-medium text-sm truncate">{item.key}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">"{item.text}"</p>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      {item.status === 'completed' && item.audioPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePlayAudio(item)}
                          className="h-8 w-8 p-0"
                        >
                          {currentAudio?.id === item.id && isPlaying ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateAudioBatch('base_words')}
                        className="h-8 w-8 p-0"
                        title="Gerar com IA"
                      >
                        <Bot className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRecord(item)}
                        className="h-8 w-8 p-0"
                        title="Gravar com microfone"
                      >
                        <Mic className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna Sentimentos */}
          <div className="space-y-4">
            {/* Header Sentimentos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  💭 Sentimentos
                </h3>
                <Badge variant="outline">
                  {sentiments.filter(item => item.status === 'completed').length}/{sentiments.length}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso: {sentimentProgress}%</span>
                  <span>{sentiments.filter(item => item.status === 'completed').length} gerados</span>
                </div>
                <Progress value={sentimentProgress} className="h-2" />
              </div>

              <div className="flex items-center gap-2">
                {!generatingSentiments ? (
                  <Button 
                    onClick={() => generateAudioBatch('sentiments')}
                    size="sm"
                    className="flex-1"
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    Gerar Sentimentos
                  </Button>
                ) : (
                  <Button 
                    onClick={() => stopGeneration('sentiments')}
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Parar Geração
                  </Button>
                )}
              </div>

              {/* Filtros e Paginação - Sentimentos */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(['all', 'generated', 'pending'] as FilterType[]).map((filter) => (
                    <Button
                      key={filter}
                      variant={sentimentFilter === filter ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSentimentFilter(filter);
                        setSentimentPage(1);
                      }}
                    >
                      {filter === 'all' && 'Todos'}
                      {filter === 'generated' && 'Gerados'}
                      {filter === 'pending' && 'Pendentes'}
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSentimentPage(Math.max(1, sentimentPage - 1))}
                    disabled={sentimentPage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">
                    {sentimentPage} de {sentimentTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSentimentPage(Math.min(sentimentTotalPages, sentimentPage + 1))}
                    disabled={sentimentPage >= sentimentTotalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista Sentimentos */}
            <div className="space-y-2">
              {paginatedSentiments.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-lg border ${getStatusColor(item.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(item.status)}
                        <span className="font-medium text-sm capitalize truncate">{item.key}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">"{item.text}"</p>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      {item.status === 'completed' && item.audioPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePlayAudio(item)}
                          className="h-8 w-8 p-0"
                        >
                          {currentAudio?.id === item.id && isPlaying ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateAudioBatch('sentiments')}
                        className="h-8 w-8 p-0"
                        title="Gerar com IA"
                      >
                        <Bot className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRecord(item)}
                        className="h-8 w-8 p-0"
                        title="Gravar com microfone"
                      >
                        <Mic className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};