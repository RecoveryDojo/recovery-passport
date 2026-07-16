import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  first_name: string;
  last_name: string;
  date_of_birth: string; // yyyy-mm-dd
  email?: string;
  intake_peer_id: string;
  program_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const authed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    // Confirm role peer_specialist or admin
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("role")
      .eq("id", callerId)
      .single();
    if (userErr || !userRow) return json({ error: "Forbidden" }, 403);
    if (!["peer_specialist", "admin"].includes(userRow.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as Body;
    const { first_name, last_name, date_of_birth, intake_peer_id, program_id } = body;
    let { email } = body;

    if (!first_name?.trim() || !last_name?.trim() || !date_of_birth || !intake_peer_id || !program_id) {
      return json({ error: "Missing required fields" }, 400);
    }

    if (!email?.trim()) {
      email = `intake+${crypto.randomUUID()}@recoverypassport.placeholder`;
    }

    // Create auth user; handle_new_user trigger will insert public.users + participant_profiles
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "participant" },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "Failed to create user" }, 400);
    }
    const newUserId = created.user.id;

    // Update auto-created participant_profiles row
    const { data: profile, error: profErr } = await admin
      .from("participant_profiles")
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        date_of_birth,
        current_program_id: program_id,
        assigned_peer_id: intake_peer_id,
      })
      .eq("user_id", newUserId)
      .select("id")
      .single();

    if (profErr || !profile) {
      return json({ error: profErr?.message ?? "Failed to update profile" }, 500);
    }

    return json({
      user_id: newUserId,
      participant_profile_id: profile.id,
      email,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
