import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const { participant_profile_id, new_email } = (await req.json()) as {
      participant_profile_id: string;
      new_email: string;
    };
    const email = (new_email || "").trim().toLowerCase();
    if (!participant_profile_id || !email) return json({ error: "Missing fields" }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: "Invalid email format" }, 400);

    const { data: profile, error: profErr } = await admin
      .from("participant_profiles")
      .select("user_id")
      .eq("id", participant_profile_id)
      .single();
    if (profErr || !profile?.user_id) return json({ error: "Participant not found" }, 404);

    // Check for existing use
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing && existing.id !== profile.user_id) {
      return json({ error: "That email is already in use." }, 409);
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(profile.user_id, {
      email,
      email_confirm: true,
    });
    if (authErr) return json({ error: authErr.message }, 400);

    const { error: dbErr } = await admin
      .from("users")
      .update({ email })
      .eq("id", profile.user_id);
    if (dbErr) return json({ error: dbErr.message }, 500);

    return json({ ok: true, email });
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
