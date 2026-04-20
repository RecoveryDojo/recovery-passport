/**
 * Shared clinical summary hook for a single participant.
 *
 * One React Query hook → one Supabase round trip set → drives the peer
 * detail page (Phase 3), the admin sheet (Phase 4), and the CardPage Today
 * section (Phase 2). Subscribes to the contract realtime channels and
 * invalidates the matching qk.* keys on payload arrival.
 *
 * See: docs/interdependency-map.md, src/lib/realtime-channels.ts
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { channels, qk } from "@/lib/realtime-channels";
import type { Database } from "@/integrations/supabase/types";

type CardLevel = Database["public"]["Enums"]["card_level"];
type PlanPhase = Database["public"]["Enums"]["plan_phase"];
type NoteType = Database["public"]["Enums"]["note_type"];
type ContactMode = Database["public"]["Enums"]["checkin_contact_mode"];
type FeedbackTarget = Database["public"]["Enums"]["feedback_target_type"];

export interface ClinicalSummary {
  profile: {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    pathway: string | null;
    substances: string[] | null;
    recovery_start_date: string | null;
    card_level: CardLevel;
    assigned_peer_id: string | null;
    program: { id: string; name: string; type: string } | null;
  } | null;
  activePhase: {
    id: string;
    phase: PlanPhase;
    title: string;
    focus_description: string | null;
    plan_id: string;
  } | null;
  planSteps: Array<{
    id: string;
    description: string;
    is_completed: boolean;
    completed_at: string | null;
    sort_order: number;
    phase_id: string;
  }>;
  earnedMilestones: Array<{
    id: string;
    unlocked_at: string;
    milestone: { id: string; name: string; sort_order: number } | null;
  }>;
  nextMilestones: Array<{
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
  }>;
  totalMilestoneCount: number;
  recentAssessments: Array<{
    id: string;
    completed_at: string;
    overall_score: number | null;
    confirmed_by: string | null;
  }>;
  recentCheckins: Array<{
    id: string;
    checkin_date: string;
    mood_status: number;
    contact_mode: ContactMode | null;
    peer_specialist_id: string | null;
    summary: string | null;
  }>;
  recentNotes: Array<{
    id: string;
    created_at: string;
    note_type: NoteType;
    content: string;
    author_id: string;
  }>;
  agreementCount: number;
  consentCount: number;
  sharedLinkCount: number;
  assignedPeer: {
    user_id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    caseload_size: number;
  } | null;
  supervisorFeedback: Array<{
    id: string;
    created_at: string;
    feedback: string;
    target_type: FeedbackTarget;
    target_id: string;
    supervisor_id: string;
  }>;
}

/**
 * Returns the full clinical summary for one participant.
 * Caller passes the participant_profiles.id (NOT the user_id).
 */
export function useParticipantClinicalSummary(participantId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<ClinicalSummary>({
    queryKey: ["participant-clinical-summary", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const pid = participantId!;

      // ── 1. Profile + program ────────────────────────────────────────────
      const { data: profileRow, error: profileErr } = await supabase
        .from("participant_profiles")
        .select(
          "id, user_id, first_name, last_name, photo_url, pathway, substances, recovery_start_date, card_level, assigned_peer_id, programs:current_program_id(id, name, type)"
        )
        .eq("id", pid)
        .maybeSingle();
      if (profileErr) throw profileErr;

      const profile = profileRow
        ? {
            id: profileRow.id,
            user_id: profileRow.user_id,
            first_name: profileRow.first_name,
            last_name: profileRow.last_name,
            photo_url: profileRow.photo_url,
            pathway: profileRow.pathway,
            substances: profileRow.substances,
            recovery_start_date: profileRow.recovery_start_date,
            card_level: profileRow.card_level,
            assigned_peer_id: profileRow.assigned_peer_id,
            program: (profileRow.programs as { id: string; name: string; type: string } | null) ?? null,
          }
        : null;

      // ── 2. Active phase + steps ─────────────────────────────────────────
      const { data: planRow } = await supabase
        .from("recovery_plans")
        .select("id")
        .eq("participant_id", pid)
        .eq("is_current", true)
        .maybeSingle();

      let activePhase: ClinicalSummary["activePhase"] = null;
      let planSteps: ClinicalSummary["planSteps"] = [];

      if (planRow?.id) {
        const { data: phaseRow } = await supabase
          .from("plan_phases")
          .select("id, phase, title, focus_description, plan_id")
          .eq("plan_id", planRow.id)
          .eq("is_active", true)
          .maybeSingle();
        if (phaseRow) {
          activePhase = phaseRow;
          const { data: stepRows } = await supabase
            .from("plan_action_steps")
            .select("id, description, is_completed, completed_at, sort_order, phase_id")
            .eq("phase_id", phaseRow.id)
            .order("sort_order", { ascending: true });
          planSteps = stepRows ?? [];
        }
      }

      // ── 3. Milestones (earned + next) ───────────────────────────────────
      const [earnedRes, allDefsRes] = await Promise.all([
        supabase
          .from("participant_milestones")
          .select("id, unlocked_at, milestone_definitions:milestone_id(id, name, sort_order)")
          .eq("participant_id", pid)
          .order("unlocked_at", { ascending: false }),
        supabase
          .from("milestone_definitions")
          .select("id, name, description, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      const earnedMilestones = (earnedRes.data ?? []).map((row) => ({
        id: row.id,
        unlocked_at: row.unlocked_at,
        milestone: (row.milestone_definitions as { id: string; name: string; sort_order: number } | null) ?? null,
      }));

      const earnedIds = new Set(
        earnedMilestones.map((m) => m.milestone?.id).filter(Boolean) as string[]
      );
      const nextMilestones = (allDefsRes.data ?? [])
        .filter((d) => !earnedIds.has(d.id))
        .slice(0, 3);
      const totalMilestoneCount = (allDefsRes.data ?? []).length;

      // ── 4. Last 6 assessments ───────────────────────────────────────────
      const { data: assessmentRows } = await supabase
        .from("assessment_sessions")
        .select("id, completed_at, overall_score, confirmed_by")
        .eq("participant_id", pid)
        .order("completed_at", { ascending: false })
        .limit(6);

      // ── 5. Last 8 weeks of weekly_checkins ──────────────────────────────
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
      const { data: checkinRows } = await supabase
        .from("weekly_checkins")
        .select("id, checkin_date, mood_status, contact_mode, peer_specialist_id, summary")
        .eq("participant_id", pid)
        .gte("checkin_date", eightWeeksAgo.toISOString().slice(0, 10))
        .order("checkin_date", { ascending: false });

      // ── 6. Last 5 progress_notes ────────────────────────────────────────
      const { data: noteRows } = await supabase
        .from("progress_notes")
        .select("id, created_at, note_type, content, author_id")
        .eq("participant_id", pid)
        .order("created_at", { ascending: false })
        .limit(5);

      // ── 7. Counts: agreements / consent / shared_links ──────────────────
      const [agreementCountRes, consentCountRes, sharedLinkCountRes] = await Promise.all([
        supabase
          .from("agreement_acknowledgments")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", pid),
        supabase
          .from("consent_records")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", pid)
          .eq("is_revoked", false),
        supabase
          .from("shared_links")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", pid)
          .eq("is_revoked", false),
      ]);

      // ── 8. Assigned peer + caseload size ────────────────────────────────
      let assignedPeer: ClinicalSummary["assignedPeer"] = null;
      if (profile?.assigned_peer_id) {
        const { data: peerRow } = await supabase
          .from("peer_specialist_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .eq("user_id", profile.assigned_peer_id)
          .maybeSingle();
        const { count: caseloadCount } = await supabase
          .from("participant_profiles")
          .select("id", { count: "exact", head: true })
          .eq("assigned_peer_id", profile.assigned_peer_id)
          .is("deleted_at", null);
        if (peerRow) {
          assignedPeer = { ...peerRow, caseload_size: caseloadCount ?? 0 };
        }
      }

      // ── 9. Supervisor feedback for this participant ─────────────────────
      // Filter by linking targets (checkins / notes / milestones) belonging to this participant.
      const checkinIds = (checkinRows ?? []).map((c) => c.id);
      const noteIds = (noteRows ?? []).map((n) => n.id);
      const milestoneRowIds = earnedMilestones.map((m) => m.id);

      let supervisorFeedback: ClinicalSummary["supervisorFeedback"] = [];
      const allTargetIds = [...checkinIds, ...noteIds, ...milestoneRowIds];
      if (allTargetIds.length > 0) {
        const { data: fbRows } = await supabase
          .from("supervisor_feedback")
          .select("id, created_at, feedback, target_type, target_id, supervisor_id")
          .in("target_id", allTargetIds)
          .order("created_at", { ascending: false });
        supervisorFeedback = fbRows ?? [];
      }

      return {
        profile,
        activePhase,
        planSteps,
        earnedMilestones,
        nextMilestones,
        totalMilestoneCount,
        recentAssessments: assessmentRows ?? [],
        recentCheckins: checkinRows ?? [],
        recentNotes: noteRows ?? [],
        agreementCount: agreementCountRes.count ?? 0,
        consentCount: consentCountRes.count ?? 0,
        sharedLinkCount: sharedLinkCountRes.count ?? 0,
        assignedPeer,
        supervisorFeedback,
      };
    },
  });

  // ── Realtime: subscribe to all relevant per-participant channels ────────
  useEffect(() => {
    if (!participantId) return;

    const invalidateAll = () => {
      queryClient.invalidateQueries({
        queryKey: ["participant-clinical-summary", participantId],
      });
    };

    // Unique suffix per mount to avoid colliding with Supabase's internal
    // channel cache when StrictMode / re-renders cause the effect to re-run
    // before the previous removeChannel() has completed.
    const uid = Math.random().toString(36).slice(2, 10);

    const checkinsChan = supabase
      .channel(`${channels.checkins(participantId)}-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_checkins", filter: `participant_id=eq.${participantId}` },
        () => {
          invalidateAll();
          queryClient.invalidateQueries({ queryKey: qk.weeklyCheckins(participantId) });
          queryClient.invalidateQueries({ queryKey: qk.moodTrend(participantId) });
        }
      )
      .subscribe();

    const notesChan = supabase
      .channel(`${channels.notes(participantId)}-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "progress_notes", filter: `participant_id=eq.${participantId}` },
        () => {
          invalidateAll();
          queryClient.invalidateQueries({ queryKey: qk.participantNotes(participantId) });
        }
      )
      .subscribe();

    const milestonesChan = supabase
      .channel(`${channels.milestones(participantId)}-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participant_milestones", filter: `participant_id=eq.${participantId}` },
        () => {
          invalidateAll();
          queryClient.invalidateQueries({ queryKey: qk.milestoneStats(participantId) });
          queryClient.invalidateQueries({ queryKey: qk.recentMilestones(participantId) });
        }
      )
      .subscribe();

    const assessmentsChan = supabase
      .channel(`${channels.assessments(participantId)}-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessment_sessions", filter: `participant_id=eq.${participantId}` },
        () => {
          invalidateAll();
          queryClient.invalidateQueries({ queryKey: qk.rcScores(participantId) });
        }
      )
      .subscribe();

    const planChan = supabase
      .channel(`${channels.plan(participantId)}-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_action_steps" },
        () => {
          invalidateAll();
          queryClient.invalidateQueries({ queryKey: qk.participantPlan(participantId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checkinsChan);
      supabase.removeChannel(notesChan);
      supabase.removeChannel(milestonesChan);
      supabase.removeChannel(assessmentsChan);
      supabase.removeChannel(planChan);
    };
  }, [participantId, queryClient]);

  return query;
}
