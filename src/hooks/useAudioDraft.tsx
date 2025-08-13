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
  const [audioDrafts, setAudioDrafts] = useState<AudioDraft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load existing audio drafts
  const loadAudioDrafts = useCallback(async () => {
    if (!user || !sessionId) return;

    setIsLoadingDrafts(true);
    try {
      const { data, error } = await supabase
        .from('user_audio_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAudioDrafts(data || []);
    } catch (error) {
      console.error('Error loading audio drafts:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os rascunhos de áudio.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [user, sessionId, toast]);

  // Save audio draft
  const saveAudioDraft = useCallback(async (audioBlob: Blob, duration?: number) => {
    if (!user || !sessionId) return null;

    setIsSavingDraft(true);
    try {
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

      // Save metadata to database
      const { data, error } = await supabase
        .from('user_audio_drafts')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          audio_path: filePath,
          audio_duration: duration,
          audio_size: audioBlob.size,
          mime_type: audioBlob.type || 'audio/webm'
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setAudioDrafts(prev => [data, ...prev]);
      
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
  }, [user, sessionId, toast]);

  // Delete audio draft
  const deleteAudioDraft = useCallback(async (draftId: string) => {
    try {
      const draft = audioDrafts.find(d => d.id === draftId);
      if (!draft) return;

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
      setAudioDrafts(prev => prev.filter(d => d.id !== draftId));
      
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
  }, [audioDrafts, toast]);

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
    audioDrafts,
    isLoadingDrafts,
    isSavingDraft,
    loadAudioDrafts,
    saveAudioDraft,
    deleteAudioDraft,
    getAudioUrl
  };
};