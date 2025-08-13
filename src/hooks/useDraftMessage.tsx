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
  const tempSessionId = useRef<string | null>(null);

  // Create temp session if none exists
  const getOrCreateTempSession = useCallback(() => {
    if (sessionId) return sessionId;
    if (!tempSessionId.current) {
      tempSessionId.current = crypto.randomUUID();
      console.log('useDraftMessage: Created temp session:', tempSessionId.current);
    }
    return tempSessionId.current;
  }, [sessionId]);

  // Load existing draft on mount or session change
  const loadDraft = useCallback(async () => {
    if (!user) return;

    // Try localStorage first as fallback
    const localKey = `draft_${user.id}_${sessionId || 'temp'}`;
    const localDraft = localStorage.getItem(localKey);
    if (localDraft) {
      console.log('useDraftMessage: Loaded from localStorage');
      setDraftContent(localDraft);
      setHasDraft(true);
    }

    const currentSessionId = getOrCreateTempSession();
    console.log('useDraftMessage: Loading draft for session:', currentSessionId);

    try {
      const { data, error } = await supabase
        .from('user_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', currentSessionId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('useDraftMessage: Error loading draft:', error);
        return;
      }

      if (data) {
        console.log('useDraftMessage: Loaded draft from Supabase');
        setDraftContent(data.draft_content);
        setHasDraft(true);
        currentDraftId.current = data.id;
        // Sync with localStorage
        localStorage.setItem(localKey, data.draft_content);
      }
    } catch (error) {
      console.error('useDraftMessage: Error loading draft:', error);
    }
  }, [user, sessionId, getOrCreateTempSession]);

  // Save draft with debounce
  const saveDraft = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;

    const currentSessionId = getOrCreateTempSession();
    console.log('useDraftMessage: Saving draft for session:', currentSessionId);
    
    setIsDraftSaving(true);

    // Save to localStorage immediately as fallback
    const localKey = `draft_${user.id}_${sessionId || 'temp'}`;
    localStorage.setItem(localKey, content);

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
        console.log('useDraftMessage: Updated existing draft');
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('user_drafts')
          .insert({
            user_id: user.id,
            session_id: currentSessionId,
            draft_content: content
          })
          .select()
          .single();

        if (error) throw error;
        currentDraftId.current = data.id;
        console.log('useDraftMessage: Created new draft');
      }

      setHasDraft(true);
    } catch (error) {
      console.error('useDraftMessage: Error saving draft:', error);
      // Keep localStorage as fallback
    } finally {
      setIsDraftSaving(false);
    }
  }, [user, sessionId, getOrCreateTempSession]);

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
    console.log('useDraftMessage: Clearing draft');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear localStorage
    if (user) {
      const localKey = `draft_${user.id}_${sessionId || 'temp'}`;
      localStorage.removeItem(localKey);
    }

    if (currentDraftId.current) {
      try {
        await supabase
          .from('user_drafts')
          .delete()
          .eq('id', currentDraftId.current);
        console.log('useDraftMessage: Deleted draft from Supabase');
      } catch (error) {
        console.error('useDraftMessage: Error clearing draft:', error);
      }
    }

    setDraftContent('');
    setHasDraft(false);
    currentDraftId.current = null;
  }, [user, sessionId]);

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