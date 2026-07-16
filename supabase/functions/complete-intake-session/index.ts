import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: userRow } = await admin.from("users").select("role").eq("id", callerId).single();
    if (!userRow || !["peer_specialist", "admin"].includes(userRow.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const { session_id } = (await req.json()) as { session_id: string };
    if (!session_id) return json({ error: "Missing session_id" }, 400);

    // Fetch session
    const { data: session, error: sessErr } = await admin
      .from("intake_sessions")
      .select("id, participant_id, status")
      .eq("id", session_id)
      .single();
    if (sessErr || !session) return json({ error: "Session not found" }, 404);
    if (session.status === "completed") return json({ ok: true, already: true });
    if (!session.participant_id) return json({ error: "Session missing participant" }, 400);

    // Get substances reported during intake
    const { data: subs } = await admin
      .from("intake_substance_use")
      .select("substance_name")
      .eq("intake_session_id", session_id);
    const substanceNames = Array.from(
      new Set((subs ?? []).map((s) => (s.substance_name || "").trim()).filter(Boolean)),
    );

    // Merge with existing substances
    const { data: existingProfile } = await admin
      .from("participant_profiles")
      .select("substances")
      .eq("id", session.participant_id)
      .single();
    const existing: string[] = Array.isArray(existingProfile?.substances)
      ? (existingProfile!.substances as string[])
      : [];
    const merged = Array.from(new Set([...existing, ...substanceNames]));

    const today = new Date().toISOString().slice(0, 10);

    // Update participant profile
    const { error: updProfileErr } = await admin
      .from("participant_profiles")
      .update({
        admission_date: today,
        participant_status: "active",
        substances: merged,
      })
      .eq("id", session.participant_id);
    if (updProfileErr) throw updProfileErr;

    // Mark session complete (audit trigger fires)
    const { error: updSessErr } = await admin
      .from("intake_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session_id);
    if (updSessErr) {
      // rollback profile change on failure
      await admin
        .from("participant_profiles")
        .update({
          admission_date: null,
          participant_status: null,
          substances: existing,
        })
        .eq("id", session.participant_id);
      throw updSessErr;
    }

    // Notify all admins
    const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
    if (admins?.length) {
      const notifications = admins.map((a) => ({
        user_id: a.id,
        type: "new_participant",
        title: "New participant admitted",
        body: "An intake session has been completed.",
        metadata: { intake_session_id: session_id, participant_id: session.participant_id },
      }));
      await admin.from("notifications").insert(notifications);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
