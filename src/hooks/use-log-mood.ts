/**
 * Participant self-mood logger.
 *
 * Inserts a mood-only row into weekly_checkins. peer_specialist_id is NULL
 * (allowed by Phase 2A migration). Skips log_checkin_crps_hours (no peer to
 * credit). Still emits checkin.logged + checkin.low_mood through the contract.
 *
 * Used by the participant Today section (CardPage) and any quick-action FAB.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { emitEvent } from "@/lib/events";

export interface LogMoodPayload {
  participantId: string;
  participantName: string;
  participantUserId: string;
  moodScore: number;
}

interface UseLogMoodOptions {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export function useLogMood({ onSuccess, onError }: UseLogMoodOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LogMoodPayload) => {
      const { participantId, participantName, moodScore } = payload;

      // 1. Insert mood-only check-in (peer_specialist_id NULL, no contact_mode)
      const { data: checkin, error: insertErr } = await supabase
        .from("weekly_checkins")
        .insert({
          participant_id: participantId,
          peer_specialist_id: null,
          mood_status: moodScore,
          contact_mode: null,
          discussed_plan: null,
          summary: null,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // 2. Emit checkin.logged (no recipients — peer-side caseload pill
      //    invalidates via realtime on weekly_checkins).
      await emitEvent("checkin.logged", {
        target_type: "weekly_checkin",
        target_id: checkin?.id,
        metadata: { participantId, participantName, moodScore, source: "self" },
      });

      // 3. Low-mood alert: notify all admins
      if (moodScore <= 2) {
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .eq("role", "admin");

        await emitEvent("checkin.low_mood", {
          target_type: "weekly_checkin",
          target_id: checkin?.id,
          metadata: { participantId, participantName, moodScore, source: "self" },
          recipients: (admins ?? []).map((a) => ({
            user_id: a.id,
            type: "general",
            title: "Low mood self-report",
            body: `${participantName} reported a low mood (${moodScore}/5).`,
            link: `/admin/participants`,
          })),
        });
      }

      return checkin;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseload-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["mood-trend"] });
      queryClient.invalidateQueries({ queryKey: ["participant-clinical-summary"] });
      queryClient.invalidateQueries({ queryKey: ["today-mood"] });
      onSuccess?.();
    },
    onError: (err: Error) => onError?.(err),
  });
}
