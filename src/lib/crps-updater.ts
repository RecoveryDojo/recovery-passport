import { supabase } from "@/integrations/supabase/client";

type CrpsAction =
  | "checkin"
  | "assessment_confirmed"
  | "milestone_unlocked"
  | "progress_note"
  | "referral"
  | "plan_edit"
  | "self_care";

interface CrpsUpdateParams {
  action: CrpsAction;
  peer_id?: string;
  note_type?: string;
  participant_id?: string;
}

/**
 * Fire-and-forget call to update CRPS competency milestones.
 * Non-blocking — errors are silently logged.
 */
export function updateCrpsCompetencies(params: CrpsUpdateParams) {
  try {
    const result = supabase.functions.invoke("update-crps-competencies", {
      body: params,
    });
    // Handle async rejection without surfacing to caller
    Promise.resolve(result).catch((err) => {
      console.warn("CRPS update failed (non-blocking):", err);
    });
  } catch (err) {
    // Catch any synchronous throws too
    console.warn("CRPS update failed synchronously (non-blocking):", err);
  }
}
