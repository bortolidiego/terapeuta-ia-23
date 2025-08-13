import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

interface AudioDraft {
  id: string;
  audio_path: string;
  audio_duration?: number;
  audio_size?: number;
  mime_type: string;
  created_at: string;
}

export const useAudioDraft = (sessionId?: string) => {
  const [audioDraft, setAudioDraft] = useState<AudioDraft | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load existing audio draft (only one per session)
  const loadAudioDraft = useCallback(async () => {
    if (!user || !sessionId) return;

    setIsLoadingDraft(true);
    try {
      const { data, error } = await supabase
        .from('user_audio_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      setAudioDraft(data);
    } catch (error) {
      console.error('Error loading audio draft:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o rascunho de áudio.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDraft(false);
    }
  }, [user, sessionId, toast]);

  // Save audio draft (replaces existing one)
  const saveAudioDraft = useCallback(async (audioBlob: Blob, duration?: number) => {
    if (!user || !sessionId) return null;

    setIsSavingDraft(true);
    try {
      // Delete existing draft first (if any)
      if (audioDraft) {
        await deleteAudioDraft(audioDraft.id);
      }

      // Generate unique file path
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('audio-drafts')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Save metadata to database (upsert to replace existing)
      const { data, error } = await supabase
        .from('user_audio_drafts')
        .upsert({
          user_id: user.id,
          session_id: sessionId,
          audio_path: filePath,
          audio_duration: duration,
          audio_size: audioBlob.size,
          mime_type: audioBlob.type || 'audio/webm'
        }, {
          onConflict: 'user_id,session_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setAudioDraft(data);
      
      toast({
        title: 'Rascunho salvo',
        description: 'Áudio salvo como rascunho.',
      });

      return data;
    } catch (error) {
      console.error('Error saving audio draft:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o rascunho de áudio.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  }, [user, sessionId, toast, audioDraft]);

  // Delete audio draft
  const deleteAudioDraft = useCallback(async (draftId: string) => {
    try {
      const draft = audioDraft;
      if (!draft || draft.id !== draftId) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('audio-drafts')
        .remove([draft.audio_path]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
      }

      // Delete from database
      const { error } = await supabase
        .from('user_audio_drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      // Update local state
      setAudioDraft(null);
      
      toast({
        title: 'Rascunho excluído',
        description: 'Rascunho de áudio foi removido.',
      });
    } catch (error) {
      console.error('Error deleting audio draft:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o rascunho.',
        variant: 'destructive',
      });
    }
  }, [audioDraft, toast]);

  // Clear audio draft (used when sending message)
  const clearAudioDraft = useCallback(async () => {
    if (audioDraft) {
      await deleteAudioDraft(audioDraft.id);
    }
  }, [audioDraft, deleteAudioDraft]);

  // Get audio URL for playback
  const getAudioUrl = useCallback(async (audioPath: string) => {
    try {
      const { data } = await supabase.storage
        .from('audio-drafts')
        .createSignedUrl(audioPath, 3600); // 1 hour expiry

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting audio URL:', error);
      return null;
    }
  }, []);

  return {
    audioDraft,
    isLoadingDraft,
    isSavingDraft,
    loadAudioDraft,
    saveAudioDraft,
    deleteAudioDraft,
    clearAudioDraft,
    getAudioUrl
  };
};