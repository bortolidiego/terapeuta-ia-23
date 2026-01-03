import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ActiveSession {
  id: string;
  hasRecentMessages: boolean;
  lastActivity: string;
}

export const useSessionManager = () => {
  const pauseSession = useCallback(async (sessionId: string, generateTitle: boolean = true) => {
    try {
      // Use the new edge function for reliable pausing and title generation
      const { error } = await supabase.functions.invoke('pause-session', {
        body: { sessionId }
      });

      if (error) {
        console.error("Error pausing session with edge function:", error);

        // Fallback to direct database update
        const { error: dbError } = await supabase
          .from("therapy_sessions")
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq("id", sessionId)
          .eq("status", "active");

        if (dbError) {
          console.error("Error pausing session with direct update:", dbError);
        } else if (generateTitle) {
          // Try to generate title manually if edge function failed
          try {
            await supabase.functions.invoke('generate-session-title', {
              body: { sessionId }
            });
          } catch (titleError) {
            console.error("Error generating title:", titleError);
          }
        }
      }

      // Trigger session summarization (fire and forget)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Triggering session summarization...');
        supabase.functions.invoke('memory-manager', {
          body: {
            action: 'summarize',
            sessionId,
            userId: user.id
          }
        }).then(({ data, error }) => {
          if (error) console.error('Error summarizing session:', error);
          else console.log('Session summarization triggered:', data);
        });
      }

    } catch (error) {
      console.error("Error in pauseSession:", error);
    }
  }, []);

  const findActiveSession = useCallback(async (): Promise<ActiveSession | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Find active sessions with recent messages (last 6 hours)
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const { data: sessions, error } = await supabase
        .from("therapy_sessions")
        .select(`
          id,
          updated_at,
          session_messages(
            id,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("updated_at", sixHoursAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error || !sessions || sessions.length === 0) {
        return null;
      }

      const session = sessions[0];
      const hasMessages = session.session_messages && session.session_messages.length > 0;

      return {
        id: session.id,
        hasRecentMessages: hasMessages,
        lastActivity: session.updated_at
      };
    } catch (error) {
      console.error("Error finding active session:", error);
      return null;
    }
  }, []);

  const cleanupOrphanedSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find sessions older than 6 hours with no messages
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const { data: orphanedSessions, error: findError } = await supabase
        .from("therapy_sessions")
        .select(`
          id,
          session_messages(id)
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .lt("created_at", sixHoursAgo.toISOString());

      if (findError || !orphanedSessions) {
        console.error("Error finding orphaned sessions:", findError);
        return;
      }

      // Filter sessions with no messages
      const sessionsToCleanup = orphanedSessions.filter(
        session => !session.session_messages || session.session_messages.length === 0
      );

      if (sessionsToCleanup.length > 0) {
        console.log(`Cleaning up ${sessionsToCleanup.length} orphaned sessions`);

        const sessionIds = sessionsToCleanup.map(s => s.id);

        // Pause orphaned sessions
        const { error: updateError } = await supabase
          .from("therapy_sessions")
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .in("id", sessionIds);

        if (updateError) {
          console.error("Error updating orphaned sessions:", updateError);
        } else {
          console.log(`Successfully cleaned up ${sessionIds.length} orphaned sessions`);
        }
      }
    } catch (error) {
      console.error("Error in cleanupOrphanedSessions:", error);
    }
  }, []);

  return {
    pauseSession,
    findActiveSession,
    cleanupOrphanedSessions
  };
};