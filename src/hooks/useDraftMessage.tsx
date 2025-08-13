import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useDraftMessage = (sessionId?: string) => {
  const [draftContent, setDraftContent] = useState('');
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentDraftId = useRef<string | null>(null);

  // Load existing draft on mount or session change
  const loadDraft = useCallback(async () => {
    if (!user || !sessionId) return;

    try {
      const { data, error } = await supabase
        .from('user_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading draft:', error);
        return;
      }

      if (data) {
        setDraftContent(data.draft_content);
        setHasDraft(true);
        currentDraftId.current = data.id;
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }, [user, sessionId]);

  // Save draft with debounce
  const saveDraft = useCallback(async (content: string) => {
    if (!user || !sessionId || !content.trim()) return;

    setIsDraftSaving(true);

    try {
      if (currentDraftId.current) {
        // Update existing draft
        const { error } = await supabase
          .from('user_drafts')
          .update({ 
            draft_content: content,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentDraftId.current);

        if (error) throw error;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('user_drafts')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            draft_content: content
          })
          .select()
          .single();

        if (error) throw error;
        currentDraftId.current = data.id;
      }

      setHasDraft(true);
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsDraftSaving(false);
    }
  }, [user, sessionId]);

  // Debounced save function
  const debouncedSave = useCallback((content: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveDraft(content);
    }, 500);
  }, [saveDraft]);

  // Update draft content and trigger save
  const updateDraft = useCallback((content: string) => {
    setDraftContent(content);
    
    if (content.trim()) {
      debouncedSave(content);
    } else {
      clearDraft();
    }
  }, [debouncedSave]);

  // Clear draft
  const clearDraft = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (currentDraftId.current) {
      try {
        await supabase
          .from('user_drafts')
          .delete()
          .eq('id', currentDraftId.current);
      } catch (error) {
        console.error('Error clearing draft:', error);
      }
    }

    setDraftContent('');
    setHasDraft(false);
    currentDraftId.current = null;
  }, []);

  // Load draft when sessionId changes
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    draftContent,
    isDraftSaving,
    hasDraft,
    updateDraft,
    clearDraft,
    loadDraft
  };
};