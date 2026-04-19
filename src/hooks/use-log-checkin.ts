import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ContactMode = Database["public"]["Enums"]["checkin_contact_mode"];

export interface CheckInPayload {
  participantId: string;
  participantName: string;
  peerSpecialistId: string;
  moodScore: number;
  contactMode: ContactMode;
  notes: string;
  discussedPlan: boolean;
}

interface UseLogCheckInOptions {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Shared mutation for logging a check-in.
 * Used by both LogCheckInSheet (inline) and CheckInFormPage (full-page).
 *
 * Inserts into weekly_checkins (with new contact_mode + discussed_plan columns),
 * calls log_checkin_crps_hours RPC, and notifies all admins on mood ≤ 2.
 */
export function useLogCheckIn({ onSuccess, onError }: UseLogCheckInOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CheckInPayload) => {
      const { participantId, participantName, peerSpecialistId, moodScore, contactMode, notes, discussedPlan } = payload;

      // 1. Insert check-in
      const { data: checkin, error: insertErr } = await supabase
        .from("weekly_checkins")
        .insert({
          participant_id: participantId,
          peer_specialist_id: peerSpecialistId,
          mood_status: moodScore,
          contact_mode: contactMode,
          discussed_plan: discussedPlan,
          summary: notes.trim() || null,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // 2. CRPS hours via existing RPC
      if (checkin?.id) {
        await supabase.rpc("log_checkin_crps_hours", {
          p_checkin_id: checkin.id,
          p_peer_id: peerSpecialistId,
        });
      }

      // 3. Low-mood alert: notify all admins
      if (moodScore <= 2) {
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .eq("role", "admin");

        if (admins && admins.length > 0) {
          const rows = admins.map((a) => ({
            user_id: a.id,
            type: "general" as const,
            title: "Low mood check-in",
            body: `${participantName} reported a low mood score during check-in. Please review.`,
            link: `/caseload/${participantId}`,
            related_id: checkin?.id ?? null,
            related_type: "weekly_checkin",
          }));
          await supabase.from("notifications").insert(rows);
        }
      }

      return checkin;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseload-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["caseload"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["mood-trend"] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      onError?.(err);
    },
  });
}
