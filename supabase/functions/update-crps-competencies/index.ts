import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ActionType =
  | "checkin"
  | "assessment_confirmed"
  | "milestone_unlocked"
  | "progress_note"
  | "referral"
  | "plan_edit"
  | "self_care";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify calling user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action: ActionType = body.action;
    const peerId: string = body.peer_id ?? user.id;
    const noteType: string | undefined = body.note_type;
    const participantId: string | undefined = body.participant_id;

    if (!action || !peerId) {
      return new Response(JSON.stringify({ error: "Missing action or peer_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Helper: update status if current matches expected
    async function setStatus(
      toolOrSkill: string,
      fromStatus: string,
      toStatus: string
    ) {
      await admin
        .from("crps_competency_milestones")
        .update({ status: toStatus, updated_at: new Date().toISOString() })
        .eq("peer_specialist_id", peerId)
        .eq("tool_or_skill", toolOrSkill)
        .eq("status", fromStatus);
    }

    // Helper: set to at-least a status (won't downgrade from verified)
    async function setAtLeast(
      toolOrSkill: string,
      toStatus: string,
      notIfStatus: string[] = ["verified"]
    ) {
      const { data: current } = await admin
        .from("crps_competency_milestones")
        .select("status")
        .eq("peer_specialist_id", peerId)
        .eq("tool_or_skill", toolOrSkill)
        .single();
      if (current && !notIfStatus.includes(current.status) && current.status !== toStatus) {
        // Only upgrade, not downgrade
        const order = ["not_started", "in_progress", "demonstrated", "verified"];
        if (order.indexOf(toStatus) > order.indexOf(current.status)) {
          await admin
            .from("crps_competency_milestones")
            .update({ status: toStatus, updated_at: new Date().toISOString() })
            .eq("peer_specialist_id", peerId)
            .eq("tool_or_skill", toolOrSkill);
        }
      }
    }

    if (action === "checkin") {
      // MI + Docs: not_started → in_progress
      await setStatus("Motivational Interviewing", "not_started", "in_progress");
      await setStatus("Documentation & Progress Notes", "not_started", "in_progress");

      // Count total checkins by this peer
      const { count } = await admin
        .from("weekly_checkins")
        .select("id", { count: "exact", head: true })
        .eq("peer_specialist_id", peerId);
      const total = count ?? 0;

      if (total >= 10) {
        await setAtLeast("Motivational Interviewing", "demonstrated");
      }
      if (total >= 20) {
        await setAtLeast("Documentation & Progress Notes", "demonstrated");
      }
    }

    if (action === "assessment_confirmed") {
      await setStatus("Recovery Capital Assessment", "not_started", "in_progress");

      const { count } = await admin
        .from("assessment_sessions")
        .select("id", { count: "exact", head: true })
        .eq("confirmed_by", peerId);
      if ((count ?? 0) >= 5) {
        await setAtLeast("Recovery Capital Assessment", "demonstrated");
      }
    }

    if (action === "milestone_unlocked") {
      await setStatus("Documentation & Progress Notes", "not_started", "in_progress");
    }

    if (action === "progress_note") {
      if (noteType === "crisis") {
        await setStatus("Crisis De-escalation", "not_started", "in_progress");
        const { count } = await admin
          .from("progress_notes")
          .select("id", { count: "exact", head: true })
          .eq("author_id", peerId)
          .eq("note_type", "crisis");
        if ((count ?? 0) >= 3) {
          await setAtLeast("Crisis De-escalation", "demonstrated");
        }
      }

      if (noteType === "referral") {
        await setStatus("Resource Navigation & Referral", "not_started", "in_progress");
      }
    }

    if (action === "referral") {
      await setStatus("Resource Navigation & Referral", "not_started", "in_progress");
    }

    if (action === "plan_edit") {
      await setStatus("Recovery Management Planning", "not_started", "in_progress");

      // Count unique participants whose plans this peer has edited
      // We approximate by checking plan_action_steps created context
      // Since we can't track editor directly, count participants assigned to this peer with plans
      if (participantId) {
        const { data: assigned } = await admin
          .from("participant_profiles")
          .select("id")
          .eq("assigned_peer_id", peerId);
        const assignedWithPlans = assigned ?? [];
        // Count how many have recovery plans
        if (assignedWithPlans.length > 0) {
          const { count } = await admin
            .from("recovery_plans")
            .select("id", { count: "exact", head: true })
            .in("participant_id", assignedWithPlans.map((a) => a.id));
          if ((count ?? 0) >= 5) {
            await setAtLeast("Recovery Management Planning", "demonstrated");
          }
        }
      }
    }

    if (action === "self_care") {
      await setStatus("Self-Care & Vicarious Trauma", "not_started", "in_progress");
      const { count } = await admin
        .from("self_care_checks")
        .select("id", { count: "exact", head: true })
        .eq("peer_specialist_id", peerId);
      if ((count ?? 0) >= 3) {
        await setAtLeast("Self-Care & Vicarious Trauma", "demonstrated");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
