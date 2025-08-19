import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AudioLibraryItem {
  id: string;
  componentKey: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  audioPath?: string;
  type: 'base_word' | 'sentiment';
  createdAt: string;
  updatedAt: string;
}

interface AudioLibraryStats {
  baseWords: {
    total: number;
    completed: number;
    processing: number;
    progress: number;
  };
  sentiments: {
    total: number;
    completed: number;
    processing: number;
    progress: number;
  };
}

export const useAudioLibrary = () => {
  const [baseWords, setBaseWords] = useState<AudioLibraryItem[]>([]);
  const [sentiments, setSentiments] = useState<AudioLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Load audio library data
  const loadLibrary = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get base word components
      const { data: baseComponents, error: baseError } = await supabase
        .from('audio_components')
        .select('*')
        .eq('component_type', 'base_word')
        .eq('protocol_type', 'evento_traumatico_especifico')
        .order('component_key');

      if (baseError) throw baseError;

      // Get top sentiments
      const { data: sentimentData, error: sentimentError } = await supabase
        .from('sentimentos')
        .select('*')
        .order('frequencia_uso', { ascending: false })
        .limit(20);

      if (sentimentError) throw sentimentError;

      // Get user's audio library
      const { data: userLibrary, error: libraryError } = await supabase
        .from('user_audio_library')
        .select('*')
        .order('updated_at', { ascending: false });

      if (libraryError) throw libraryError;

      // Map base words with user audio status
      const mappedBaseWords: AudioLibraryItem[] = (baseComponents || []).map(component => {
        const userAudio = userLibrary?.find(item => 
          item.component_key === component.component_key
        );

        return {
          id: component.id,
          componentKey: component.component_key,
          text: component.text_content,
          type: 'base_word' as const,
          status: (userAudio?.status as AudioLibraryItem['status']) || 'pending',
          audioPath: userAudio?.audio_path,
          createdAt: component.created_at,
          updatedAt: userAudio?.updated_at || component.updated_at
        };
      });

      // Map sentiments with user audio status
      const mappedSentiments: AudioLibraryItem[] = (sentimentData || []).map(sentiment => {
        const componentKey = `sentiment_${sentiment.nome}`;
        const userAudio = userLibrary?.find(item => 
          item.component_key === componentKey
        );

        return {
          id: sentiment.id,
          componentKey: sentiment.nome,
          text: sentiment.contexto || `${sentiment.nome}s que eu senti`,
          type: 'sentiment' as const,
          status: (userAudio?.status as AudioLibraryItem['status']) || 'pending',
          audioPath: userAudio?.audio_path,
          createdAt: sentiment.created_at,
          updatedAt: userAudio?.updated_at || sentiment.updated_at
        };
      });

      setBaseWords(mappedBaseWords);
      setSentiments(mappedSentiments);

    } catch (error: any) {
      console.error('Error loading audio library:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar biblioteca de áudios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Generate single audio item
  const generateAudio = useCallback(async (item: AudioLibraryItem): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return false;
      }

      // Check if library item exists, create if not
      const componentKey = item.type === 'sentiment' ? `sentiment_${item.componentKey}` : item.componentKey;
      
      let { data: existingItem } = await supabase
        .from('user_audio_library')
        .select('id')
        .eq('component_key', componentKey)
        .eq('user_id', session.user.id)
        .maybeSingle();

      let libraryItemId = existingItem?.id;

      if (!libraryItemId) {
        const { data: newItem, error: createError } = await supabase
          .from('user_audio_library')
          .insert({
            user_id: session.user.id,
            component_key: componentKey,
            component_type: item.type === 'base_word' ? 'base' : 'sentiment',
            sentiment_name: item.type === 'sentiment' ? item.componentKey : null,
            status: 'pending'
          })
          .select('id')
          .single();

        if (createError) throw createError;
        libraryItemId = newItem.id;
      }

      // Update status to processing
      await supabase
        .from('user_audio_library')
        .update({ status: 'processing' })
        .eq('id', libraryItemId);

      // Refresh to show processing status
      await loadLibrary();

      // Call edge function to generate audio
      const { error } = await supabase.functions.invoke('generate-audio-item', {
        body: {
          libraryItemId,
          textContent: item.text
        }
      });

      if (error) throw error;

      toast({
        title: "Áudio gerado!",
        description: `"${item.text}" foi gerado com sucesso`,
      });

      // Refresh library
      await loadLibrary();
      return true;

    } catch (error: any) {
      console.error('Error generating audio:', error);
      toast({
        title: "Erro na geração",
        description: error.message || "Falha ao gerar áudio",
        variant: "destructive",
      });
      
      // Refresh to show correct status
      await loadLibrary();
      return false;
    }
  }, [toast, loadLibrary]);

  // Generate batch audio
  const generateBatch = useCallback(async (type: 'base_words' | 'sentiments'): Promise<boolean> => {
    try {
      setIsGenerating(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return false;
      }

      const sentimentNames = type === 'sentiments' ? sentiments.map(s => s.componentKey) : undefined;

      const { error } = await supabase.functions.invoke('batch-generate-audio-items', {
        body: {
          sessionId: crypto.randomUUID(),
          userId: session.user.id,
          type,
          sentiments: sentimentNames
        }
      });

      if (error) throw error;

      toast({
        title: "Geração iniciada",
        description: `Geração de ${type === 'base_words' ? 'palavras base' : 'sentimentos'} iniciada`,
      });

      // Set up periodic refresh
      const interval = setInterval(loadLibrary, 5000);
      setTimeout(() => {
        clearInterval(interval);
        setIsGenerating(false);
      }, 300000); // 5 minutes

      return true;

    } catch (error: any) {
      console.error('Error generating batch:', error);
      toast({
        title: "Erro na geração",
        description: error.message || "Falha ao iniciar geração em lote",
        variant: "destructive",
      });
      setIsGenerating(false);
      return false;
    }
  }, [toast, sentiments, loadLibrary]);

  // Calculate stats
  const getStats = useCallback((): AudioLibraryStats => {
    const baseCompleted = baseWords.filter(item => item.status === 'completed').length;
    const baseProcessing = baseWords.filter(item => item.status === 'processing').length;
    
    const sentCompleted = sentiments.filter(item => item.status === 'completed').length;
    const sentProcessing = sentiments.filter(item => item.status === 'processing').length;

    return {
      baseWords: {
        total: baseWords.length,
        completed: baseCompleted,
        processing: baseProcessing,
        progress: baseWords.length > 0 ? Math.round((baseCompleted / baseWords.length) * 100) : 0
      },
      sentiments: {
        total: sentiments.length,
        completed: sentCompleted,
        processing: sentProcessing,
        progress: sentiments.length > 0 ? Math.round((sentCompleted / sentiments.length) * 100) : 0
      }
    };
  }, [baseWords, sentiments]);

  // Set up real-time subscriptions
  useEffect(() => {
    loadLibrary();

    // Subscribe to user_audio_library changes
    const subscription = supabase
      .channel('audio-library-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_audio_library'
        },
        () => {
          loadLibrary();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadLibrary]);

  return {
    baseWords,
    sentiments,
    isLoading,
    isGenerating,
    stats: getStats(),
    loadLibrary,
    generateAudio,
    generateBatch
  };
};