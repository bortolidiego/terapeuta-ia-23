import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AudioLibraryItem {
  id: string;
  componentKey: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'failed';
  audioPath?: string;
  trimEndTime?: number; // Time in seconds to stop playback (for trimmed audio)
  type: 'base_word' | 'sentiment';
  generationMethod?: 'ai' | 'manual';
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
  const loadLibrary = useCallback(async (isBackground: boolean = false) => {
    try {
      if (!isBackground) setIsLoading(true);

      // Get base word components (all base words regardless of protocol type)
      const { data: baseComponents, error: baseError } = await supabase
        .from('audio_components')
        .select('*')
        .eq('component_type', 'base_word')
        .order('component_key');

      if (baseError) throw baseError;

      // Get ALL sentimentos (no limit - load all 285 base sentimentos)
      const { data: sentimentData, error: sentimentError } = await supabase
        .from('sentimentos')
        .select('*')
        .order('nome');

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
          trimEndTime: (userAudio as any)?.trim_end_time ? Number((userAudio as any).trim_end_time) : undefined,
          generationMethod: userAudio?.generation_method as any,
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
          text: sentiment.nome,
          type: 'sentiment' as const,
          status: (userAudio?.status as AudioLibraryItem['status']) || 'pending',
          audioPath: userAudio?.audio_path,
          trimEndTime: (userAudio as any)?.trim_end_time ? Number((userAudio as any).trim_end_time) : undefined,
          generationMethod: userAudio?.generation_method as any,
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
      if (!isBackground) setIsLoading(false);
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

      // Refresh to show processing status - BACKGROUND update
      await loadLibrary(true);

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

      // Refresh library - BACKGROUND update
      await loadLibrary(true);
      return true;

    } catch (error: any) {
      console.error('Error generating audio:', error);
      toast({
        title: "Erro na geração",
        description: error.message || "Falha ao gerar áudio",
        variant: "destructive",
      });

      // Refresh to show correct status - BACKGROUND update
      await loadLibrary(true);
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

      // Set up periodic refresh - BACKGROUND updates
      const interval = setInterval(() => loadLibrary(true), 5000);
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
  // Save manually recorded audio
  const saveManualAudio = useCallback(async (item: AudioLibraryItem, audioBlob: Blob): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error("Usuário não autenticado");

      const userId = session.user.id;
      const componentKey = item.type === 'sentiment' ? `sentiment_${item.componentKey}` : item.componentKey;

      // 1. Sanitize file name
      const sanitizedKey = componentKey
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase();

      const fileName = `user-audio-library/${userId}/${Date.now()}/${sanitizedKey}_manual.webm`;

      // 2. Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-library')
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Update or Insert database record
      const { data: existingRecord } = await supabase
        .from('user_audio_library')
        .select('id')
        .eq('user_id', userId)
        .eq('component_key', componentKey)
        .maybeSingle();

      if (existingRecord) {
        const { error: updateError } = await supabase
          .from('user_audio_library')
          .update({
            audio_path: uploadData.path,
            status: 'completed',
            generation_method: 'manual',
            trim_end_time: null,
            full_text: null,
            display_text: item.text,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_audio_library')
          .insert({
            user_id: userId,
            component_key: componentKey,
            component_type: item.type === 'base_word' ? 'base' : 'sentiment',
            sentiment_name: item.type === 'sentiment' ? item.componentKey : null,
            audio_path: uploadData.path,
            status: 'completed',
            generation_method: 'manual',
            display_text: item.text
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Áudio salvo!",
        description: `Gravação manual para "${item.text}" salva com sucesso`,
      });

      await loadLibrary(true);
      return true;
    } catch (error: any) {
      console.error('Error saving manual audio:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao salvar gravação manual",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, loadLibrary]);

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
    loadLibrary(); // Initial load (shows loader)

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
          loadLibrary(true); // Realtime background update
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
    generateBatch,
    saveManualAudio
  };
};