import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY = 86400000;
const PASSWORD = "DemoPass123!";
const PROGRAM_ID = "c5948b2f-5f2d-4880-b304-c5eaff8361bf";

const MILESTONES = [
  { id: "aa92a259-13b3-4612-935e-21fa9b809c4b", name: "Completed Intake" },
  { id: "099dc9f0-d069-4adb-a9da-aa2613351d89", name: "First 72 Hours" },
  { id: "9e4cee43-eeb0-455d-987e-ef95e812e266", name: "Completed Second Day" },
  { id: "93269c08-eee1-4b84-bdd8-043e893aa770", name: "First 7 Days" },
  { id: "7c1241da-6054-4071-a032-42e1a71a8bee", name: "Attended First Group" },
  { id: "1b1582fa-0841-4fd5-a162-fe833ad158a7", name: "Connected to Sponsor/Mentor" },
  { id: "fa0008d0-3277-4150-8d84-f7db978b6b8e", name: "30 Days" },
  { id: "e43a4a74-e0d2-4458-a763-8f8742c8d87c", name: "Completed First Assessment" },
  { id: "a56b4427-9f42-4786-906c-6b17b2f90ecc", name: "60 Days" },
  { id: "46fda5bc-d478-4580-b266-39e29d72959b", name: "Secured Housing Plan" },
  { id: "f816f781-b5a1-4bbe-95a0-ca7a3df91d9e", name: "90 Days" },
  { id: "898a69f9-214c-41b4-8681-2a584873232b", name: "Employment or Education Connected" },
  { id: "27933f7b-6009-4332-b902-c9ecbc49eb38", name: "Discharge Plan Approved" },
];

const DOMAINS = [
  "bd7189e0-d3a5-4903-9e76-fe1aef57837e", // Housing
  "6c5331f1-e830-4029-949f-f6d4507d5d05", // Employment
  "37f9cb1b-4de0-4b1e-98b5-13d9bb70ac60", // Social
  "676eb69e-21b0-46f6-bf90-5257a6f3f997", // Physical
  "9616fe43-5845-4788-a979-d0803384f2bd", // Mental
  "7d47b749-bc7c-403a-af0e-093779ea7111", // Substance
  "7ae54308-d081-4c38-a1f8-13705cae2099", // Legal
  "c8ebc0cd-3701-448c-b606-d618d7e60902", // Community
  "22e92b92-5044-406e-8f2a-61f29ea13f0a", // Life Skills
  "7edbf0d0-1e01-410f-9477-7caea025dfae", // Purpose
];

const PARTNER_ID = "584bded1-561c-459d-bf9d-6677dec76836"; // Catholic Charities

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: userData } = await userClient.from("users").select("role").eq("id", user.id).single();
  if (userData?.role !== "admin") return json({ error: "Admin only" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { action } = await req.json();

  try {
    if (action === "clear") return await clearDemo(admin);
    if (action === "seed") return await seedDemo(admin, user.id);
    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("demo-seed error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function clearDemo(admin: any) {
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "demo_user_ids").single();
  if (!cfg?.value) return json({ message: "Nothing to clear" });
  const userIds: string[] = JSON.parse(cfg.value);
  if (userIds.length === 0) return json({ message: "Nothing to clear" });

  const { data: pProfs } = await admin.from("participant_profiles").select("id").in("user_id", userIds);
  const ppIds = (pProfs || []).map((p: any) => p.id);

  if (ppIds.length > 0) {
    const { data: plans } = await admin.from("recovery_plans").select("id").in("participant_id", ppIds);
    const planIds = (plans || []).map((p: any) => p.id);
    if (planIds.length > 0) {
      const { data: phases } = await admin.from("plan_phases").select("id").in("plan_id", planIds);
      const phaseIds = (phases || []).map((p: any) => p.id);
      if (phaseIds.length > 0) await admin.from("plan_action_steps").delete().in("phase_id", phaseIds);
      await admin.from("plan_phases").delete().in("plan_id", planIds);
    }
    await admin.from("recovery_plans").delete().in("participant_id", ppIds);

    const { data: sess } = await admin.from("assessment_sessions").select("id").in("participant_id", ppIds);
    const sessIds = (sess || []).map((s: any) => s.id);
    if (sessIds.length > 0) await admin.from("assessment_scores").delete().in("session_id", sessIds);
    await admin.from("assessment_sessions").delete().in("participant_id", ppIds);

    const { data: links } = await admin.from("shared_links").select("id").in("participant_id", ppIds);
    const linkIds = (links || []).map((l: any) => l.id);

    await admin.from("participant_milestones").delete().in("participant_id", ppIds);
    await admin.from("weekly_checkins").delete().in("participant_id", ppIds);
    await admin.from("progress_notes").delete().in("participant_id", ppIds);
    await admin.from("payment_records").delete().in("participant_id", ppIds);
    await admin.from("referrals").delete().in("participant_id", ppIds);
    await admin.from("agreement_acknowledgments").delete().in("participant_id", ppIds);
    await admin.from("consent_records").delete().in("participant_id", ppIds);
    await admin.from("shared_links").delete().in("participant_id", ppIds);
    await admin.from("peer_requests").delete().in("participant_id", ppIds);
    if (linkIds.length > 0) {
      await admin.from("audit_log").delete().in("target_id", linkIds).eq("target_type", "shared_links");
    }
  }

  await admin.from("notifications").delete().in("user_id", userIds);
  await admin.from("crps_hours_log").delete().in("peer_specialist_id", userIds);
  await admin.from("crps_competency_milestones").delete().in("peer_specialist_id", userIds);
  await admin.from("self_care_checks").delete().in("peer_specialist_id", userIds);
  await admin.from("supervisor_feedback").delete().in("supervisor_id", userIds);
  await admin.from("audit_log").delete().in("user_id", userIds);

  await admin.from("participant_profiles").delete().in("user_id", userIds);
  await admin.from("peer_specialist_profiles").delete().in("user_id", userIds);
  await admin.from("users").delete().in("id", userIds);

  for (const uid of userIds) {
    try { await admin.auth.admin.deleteUser(uid); } catch (_) {}
  }

  await admin.from("app_config").update({ value: "[]", updated_at: new Date().toISOString() }).eq("key", "demo_user_ids");
  return json({ message: "Demo cleared", count: userIds.length });
}

async function seedDemo(admin: any, adminUserId: string) {
  const { data: existing } = await admin.from("app_config").select("value").eq("key", "demo_user_ids").maybeSingle();
  if (existing?.value && JSON.parse(existing.value).length > 0) {
    return json({ error: "Demo already loaded. Clear first." }, 400);
  }

  const allUserIds: string[] = [];
  const now = Date.now();

  async function createUser(email: string, role: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { role },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    allUserIds.push(data.user.id);
    return data.user.id;
  }

  function ago(days: number) { return new Date(now - days * DAY).toISOString(); }
  function agoDate(days: number) { return new Date(now - days * DAY).toISOString().split("T")[0]; }

  // ===== ADMIN =====
  const patId = await createUser("pat.reyes@demo.recoverypassport.org", "admin");
  await admin.from("users").update({ role: "admin" }).eq("id", patId);

  // ===== PEERS =====
  const mariaId = await createUser("maria.santos@demo.recoverypassport.org", "peer_specialist");
  const danielaId = await createUser("daniela.cruz@demo.recoverypassport.org", "peer_specialist");
  const jamesId = await createUser("james.walker@demo.recoverypassport.org", "peer_specialist");
  const kimId = await createUser("kim.park@demo.recoverypassport.org", "peer_specialist");

  await admin.from("peer_specialist_profiles").update({
    first_name: "Maria", last_name: "Santos",
    bio: "Certified Recovery Peer Specialist with 2+ years supporting individuals in recovery. Specializes in motivational interviewing, crisis de-escalation, and housing navigation.",
    specialties: ["Motivational Interviewing", "Crisis De-escalation", "Housing Support", "MAT Support"],
    approval_status: "approved", approved_by: adminUserId, approved_at: ago(730),
    crps_status: "certified", is_available: true,
  }).eq("user_id", mariaId);

  await admin.from("peer_specialist_profiles").update({
    first_name: "Daniela", last_name: "Cruz",
    bio: "Peer specialist trainee with lived experience and a passion for recovery support. Working toward CRPS certification.",
    specialties: ["Recovery Planning", "Resource Navigation", "Family Support"],
    approval_status: "approved", approved_by: adminUserId, approved_at: ago(120),
    crps_status: "in_training", is_available: true,
  }).eq("user_id", danielaId);

  await admin.from("peer_specialist_profiles").update({
    first_name: "James", last_name: "Walker",
    bio: "Recently approved peer specialist building his caseload. Background in 12-step recovery and group facilitation.",
    specialties: ["12-Step", "Group Facilitation"],
    approval_status: "approved", approved_by: adminUserId, approved_at: ago(45),
    crps_status: "in_training", is_available: true,
    pending_edits: { bio: "Recently approved peer specialist with strong background in 12-step recovery, group facilitation, and young-adult mentorship. Available for new participants." },
  }).eq("user_id", jamesId);

  await admin.from("peer_specialist_profiles").update({
    first_name: "Kim", last_name: "Park",
    bio: "Applicant for peer specialist role. 18 months sober, completed CRPS coursework, awaiting approval.",
    specialties: ["LGBTQ+ Support", "Trauma-Informed Care"],
    approval_status: "pending",
    crps_status: "in_training", is_available: false,
  }).eq("user_id", kimId);

  // ===== Maria CRPS data — fully verified =====
  const tools = ["Motivational Interviewing", "Recovery Capital Assessment", "Recovery Management Planning", "Crisis De-escalation", "Resource Navigation & Referral", "Documentation & Progress Notes"];
  const skills = ["Advocacy", "Mentoring", "Ethical Boundaries", "Cultural Competence", "Self-Care & Vicarious Trauma", "Recovery Support Planning"];
  for (const t of [...tools, ...skills]) {
    await admin.from("crps_competency_milestones").update({
      status: "verified", verified_by: adminUserId, verified_at: ago(400),
    }).eq("peer_specialist_id", mariaId).eq("tool_or_skill", t);
  }
  // Maria: 500 hrs total, distributed
  const mariaHours = [
    ["work_experience", 250, 180], ["work_experience", 200, 90],
    ["direct_peer_services", 180, 120], ["training", 46, 200],
    ["supervised_advocacy", 25, 150], ["supervised_mentoring", 25, 150],
    ["supervised_recovery_support", 25, 150], ["supervised_professional_responsibility", 25, 150],
  ];
  for (const [cat, hrs, daysAgo] of mariaHours) {
    await admin.from("crps_hours_log").insert({
      peer_specialist_id: mariaId, category: cat, hours: hrs, source_type: "manual",
      verified_by: adminUserId, logged_at: ago(daysAgo as number),
    });
  }

  // Daniela CRPS — partial
  await admin.from("crps_competency_milestones").update({ status: "verified", verified_by: adminUserId, verified_at: ago(60) })
    .eq("peer_specialist_id", danielaId).in("tool_or_skill", ["Documentation & Progress Notes", "Recovery Capital Assessment"]);
  await admin.from("crps_competency_milestones").update({ status: "in_progress" })
    .eq("peer_specialist_id", danielaId).in("tool_or_skill", ["Motivational Interviewing", "Crisis De-escalation", "Resource Navigation & Referral", "Recovery Support Planning"]);
  for (const [cat, hrs, daysAgo] of [
    ["work_experience", 120, 60] as const, ["direct_peer_services", 60, 50] as const,
    ["training", 46, 100] as const, ["supervised_recovery_support", 12, 40] as const,
  ]) {
    await admin.from("crps_hours_log").insert({
      peer_specialist_id: danielaId, category: cat, hours: hrs, source_type: "manual", logged_at: ago(daysAgo),
    });
  }

  // James CRPS — early
  await admin.from("crps_hours_log").insert({
    peer_specialist_id: jamesId, category: "work_experience", hours: 30, source_type: "manual", logged_at: ago(30),
  });
  await admin.from("crps_hours_log").insert({
    peer_specialist_id: jamesId, category: "training", hours: 46, source_type: "manual", logged_at: ago(40),
  });

  // Self-care checks
  for (let i = 0; i < 12; i++) {
    await admin.from("self_care_checks").insert({
      peer_specialist_id: mariaId, mood: 4, energy: 4, stress: 2, is_flagged: false,
      notes: "Feeling balanced. Group supervision was helpful this week.",
      created_at: ago(180 - i * 14),
    });
  }
  // Daniela — one flagged
  for (let i = 0; i < 6; i++) {
    const flagged = i === 4;
    await admin.from("self_care_checks").insert({
      peer_specialist_id: danielaId,
      mood: flagged ? 2 : 4, energy: flagged ? 2 : 4, stress: flagged ? 4 : 2,
      is_flagged: flagged,
      notes: flagged ? "Tough week — Jasmine's crisis hit hard. Supervisor checking in." : "Steady. Manageable workload.",
      created_at: ago(90 - i * 14),
    });
  }
  await admin.from("self_care_checks").insert({
    peer_specialist_id: jamesId, mood: 5, energy: 4, stress: 2, is_flagged: false,
    notes: "Excited to be starting.", created_at: ago(15),
  });

  // ===== PARTICIPANTS =====
  type P = {
    email: string; first: string; last: string; daysAgo: number; pathway: string;
    peer: string; substances: string[]; level: string; milestoneCount: number;
    activePhases: string[]; assessments: number[]; checkins: number; hasCrisis?: boolean;
    sharedPassport?: boolean; payments?: boolean; referral?: boolean;
  };
  const participants: P[] = [
    { email: "marcus.williams@demo.recoverypassport.org", first: "Marcus", last: "Williams",
      daysAgo: 185, pathway: "twelve_step", peer: mariaId, substances: ["Alcohol", "Opioids"],
      level: "all_star", milestoneCount: 11, activePhases: ["thirty_day","sixty_day","ninety_day","six_month"],
      assessments: [2.0, 2.8, 3.5, 4.2], checkins: 24, sharedPassport: true, payments: true },
    { email: "elena.rodriguez@demo.recoverypassport.org", first: "Elena", last: "Rodriguez",
      daysAgo: 200, pathway: "mat", peer: mariaId, substances: ["Opioids"],
      level: "all_star", milestoneCount: 10, activePhases: ["thirty_day","sixty_day","ninety_day","six_month"],
      assessments: [1.9, 2.7, 3.6, 4.4], checkins: 26, sharedPassport: true, payments: true },
    { email: "jasmine.rivera@demo.recoverypassport.org", first: "Jasmine", last: "Rivera",
      daysAgo: 95, pathway: "mat", peer: danielaId, substances: ["Opioids", "Alcohol"],
      level: "veteran", milestoneCount: 7, activePhases: ["thirty_day","sixty_day","ninety_day"],
      assessments: [1.8, 2.5, 3.2], checkins: 13, hasCrisis: true, referral: true },
    { email: "tyrone.brooks@demo.recoverypassport.org", first: "Tyrone", last: "Brooks",
      daysAgo: 92, pathway: "twelve_step", peer: mariaId, substances: ["Cocaine", "Alcohol"],
      level: "veteran", milestoneCount: 8, activePhases: ["thirty_day","sixty_day","ninety_day"],
      assessments: [2.2, 3.0, 3.8], checkins: 13 },
    { email: "devon.carter@demo.recoverypassport.org", first: "Devon", last: "Carter",
      daysAgo: 48, pathway: "holistic", peer: mariaId, substances: ["Methamphetamine"],
      level: "starter", milestoneCount: 5, activePhases: ["thirty_day","sixty_day"],
      assessments: [2.4, 3.0], checkins: 7, payments: true },
    { email: "sophia.chen@demo.recoverypassport.org", first: "Sophia", last: "Chen",
      daysAgo: 50, pathway: "smart", peer: danielaId, substances: ["Alcohol"],
      level: "starter", milestoneCount: 4, activePhases: ["thirty_day","sixty_day"],
      assessments: [2.1, 2.9], checkins: 7 },
    { email: "aiden.hayes@demo.recoverypassport.org", first: "Aiden", last: "Hayes",
      daysAgo: 14, pathway: "twelve_step", peer: jamesId, substances: ["Alcohol"],
      level: "rookie", milestoneCount: 3, activePhases: ["thirty_day"],
      assessments: [2.3], checkins: 2 },
    { email: "tasha.monroe@demo.recoverypassport.org", first: "Tasha", last: "Monroe",
      daysAgo: 1, pathway: "other", peer: danielaId, substances: ["Alcohol"],
      level: "rookie", milestoneCount: 1, activePhases: [], assessments: [], checkins: 0 },
  ];

  for (const p of participants) {
    const uid = await createUser(p.email, "participant");
    await admin.from("participant_profiles").update({
      first_name: p.first, last_name: p.last,
      recovery_start_date: agoDate(p.daysAgo),
      pathway: p.pathway, current_program_id: PROGRAM_ID, assigned_peer_id: p.peer,
      substances: p.substances, card_level: p.level,
      emergency_contact_name: `${p.first}'s Emergency Contact`,
      emergency_contact_phone: "(727) 555-0100",
    }).eq("user_id", uid);

    const { data: pp } = await admin.from("participant_profiles").select("id").eq("user_id", uid).single();
    const ppId = pp.id;

    // Milestones
    for (let i = 0; i < p.milestoneCount; i++) {
      await admin.from("participant_milestones").insert({
        participant_id: ppId, milestone_id: MILESTONES[i].id,
        unlocked_by: p.peer,
        unlocked_at: ago(Math.max(0, p.daysAgo - 5 - Math.floor(i * (p.daysAgo / Math.max(p.milestoneCount, 1))))),
        note: i === 0 ? "Welcome to the program!" : `Strong work on ${MILESTONES[i].name}.`,
      });
    }
    await admin.rpc("recalculate_card_level", { p_participant_id: ppId });

    // Assessments
    let firstSessionId: string | null = null;
    for (let i = 0; i < p.assessments.length; i++) {
      const baseScore = p.assessments[i];
      const daysOff = p.daysAgo - 5 - i * Math.floor(p.daysAgo / Math.max(p.assessments.length, 1));
      const { data: sess } = await admin.from("assessment_sessions").insert({
        participant_id: ppId, initiated_by: p.peer,
        overall_score: baseScore, completed_at: ago(Math.max(0, daysOff)),
      }).select("id").single();
      if (i === 0) firstSessionId = sess.id;
      for (const did of DOMAINS) {
        const score = Math.max(1, Math.min(5, Math.round(baseScore + (Math.random() - 0.5) * 1.4)));
        await admin.from("assessment_scores").insert({ session_id: sess.id, domain_id: did, score });
      }
    }

    // Recovery plan via RPC
    if (firstSessionId) {
      await admin.rpc("generate_recovery_plan", { p_participant_id: ppId });

      // Activate phases & complete steps
      const { data: plan } = await admin.from("recovery_plans").select("id").eq("participant_id", ppId).single();
      if (plan) {
        const { data: phases } = await admin.from("plan_phases").select("id, phase").eq("plan_id", plan.id);
        for (const ph of phases || []) {
          const isActive = p.activePhases.includes(ph.phase);
          await admin.from("plan_phases").update({ is_active: isActive }).eq("id", ph.id);
          if (isActive) {
            const { data: steps } = await admin.from("plan_action_steps").select("id, sort_order").eq("phase_id", ph.id).order("sort_order");
            const stepArr = steps || [];
            // complete most steps for older phases, fewer for current
            const phaseIdx = ["thirty_day","sixty_day","ninety_day","six_month"].indexOf(ph.phase);
            const currentPhaseIdx = p.activePhases.length - 1;
            const completeRatio = phaseIdx < currentPhaseIdx ? 1.0 : 0.6;
            const toComplete = Math.floor(stepArr.length * completeRatio);
            for (let i = 0; i < toComplete; i++) {
              await admin.from("plan_action_steps").update({
                is_completed: true, completed_at: ago(Math.max(0, p.daysAgo - 10 - i * 2)),
              }).eq("id", stepArr[i].id);
            }
          }
        }
      }
    }

    // Weekly check-ins
    const moods = ["needs_support", "neutral", "good", "great"];
    const contactModes = ["in_person", "phone", "video", "text"];
    const miOptions = ["Open Questions", "Affirmations", "Reflective Listening", "Summarizing"];
    const summaries = [
      "Steady week. Continuing with daily structure and recovery routine.",
      "Discussed coping strategies for cravings. Engaged and reflective.",
      "Reviewed plan progress. Identified next steps for housing.",
      "Strong engagement. Shared wins from group attendance.",
      "Worked through anxiety about employment search. Action items set.",
      "Family contact this week — emotionally heavy but positive overall.",
      "Celebrated milestone progress. Discussed long-term goals.",
    ];
    for (let i = 0; i < p.checkins; i++) {
      const isCrisis = p.hasCrisis && i === Math.floor(p.checkins * 0.6);
      const moodVal = isCrisis ? 1 : Math.min(5, 2 + Math.floor((i / p.checkins) * 3));
      const checkinDaysAgo = Math.max(0, p.daysAgo - 7 - i * Math.floor((p.daysAgo - 7) / Math.max(p.checkins, 1)));
      const { data: ck } = await admin.from("weekly_checkins").insert({
        participant_id: ppId, peer_specialist_id: p.peer,
        mood_status: moodVal,
        checkin_date: agoDate(checkinDaysAgo),
        contact_mode: contactModes[i % contactModes.length],
        summary: isCrisis
          ? "Participant reported feeling overwhelmed and triggered by family conflict. Safety plan reviewed; no imminent danger. Crisis protocol followed; supervisor notified."
          : summaries[i % summaries.length],
        plan_progress_notes: isCrisis ? null : "On track with current phase action items.",
        next_steps: isCrisis ? "Daily check-ins for the next 5 days. Connect with crisis line if needed. Follow-up with supervisor." : "Continue with current plan. Next session in 7 days.",
        barriers: isCrisis ? "Housing instability, family conflict, increased cravings" : null,
        mi_techniques_used: [miOptions[i % 4], miOptions[(i + 1) % 4]],
        discussed_plan: i % 2 === 0,
        created_at: ago(checkinDaysAgo),
      }).select("id").single();
      if (ck) await admin.rpc("log_checkin_crps_hours", { p_checkin_id: ck.id, p_peer_id: p.peer });
    }

    // Progress notes
    if (p.checkins >= 3) {
      const noteTypes = ["general", "milestone", "transition"];
      for (let i = 0; i < Math.min(4, Math.floor(p.checkins / 3)); i++) {
        await admin.from("progress_notes").insert({
          participant_id: ppId, author_id: p.peer,
          note_type: noteTypes[i % 3] as any,
          content: `Progress note: ${p.first} continues to demonstrate growth in their recovery. Engagement has been consistent and they are responsive to MI techniques. Plan adjustments discussed and documented.`,
          created_at: ago(Math.max(0, p.daysAgo - 14 - i * 21)),
        });
      }
    }
    if (p.hasCrisis) {
      await admin.from("progress_notes").insert({
        participant_id: ppId, author_id: p.peer, note_type: "crisis" as any,
        content: `CRISIS NOTE: ${p.first} expressed feelings of being overwhelmed and reported elevated cravings due to housing instability and family conflict. Safety plan reviewed in full. No imminent danger identified. Crisis line numbers reinforced. Supervisor (admin) notified per protocol. 48-hour follow-up scheduled.`,
        created_at: ago(Math.max(0, p.daysAgo - Math.floor(p.daysAgo * 0.4))),
      });
    }

    // Agreement acknowledgment
    const { data: ag } = await admin.from("program_agreements").select("id").limit(1).maybeSingle();
    if (ag && p.daysAgo > 0) {
      await admin.from("agreement_acknowledgments").insert({
        agreement_id: ag.id, participant_id: ppId,
        acknowledged_at: ago(p.daysAgo),
      });
    }

    // Payments
    if (p.payments) {
      const weeks = Math.min(8, Math.floor(p.daysAgo / 14));
      for (let w = 0; w < weeks; w++) {
        await admin.from("payment_records").insert({
          participant_id: ppId, recorded_by: adminUserId,
          amount: 100, type: "charge",
          description: `Program fee — week ${w + 1}`,
          created_at: ago(Math.max(0, p.daysAgo - w * 14)),
        });
        if (w % 2 === 0) {
          await admin.from("payment_records").insert({
            participant_id: ppId, recorded_by: adminUserId,
            amount: 100, type: "payment",
            description: "Cash payment received",
            created_at: ago(Math.max(0, p.daysAgo - w * 14 - 2)),
          });
        }
      }
    }

    // Shared passport + consent + audit
    if (p.sharedPassport) {
      const token = `demo-${p.first.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
      const { data: link } = await admin.from("shared_links").insert({
        participant_id: ppId, token,
        visible_sections: { milestones: true, plan_summary: true, assessment_summary: true, peer_specialist: true },
        expires_at: new Date(now + 30 * DAY).toISOString(),
        created_at: ago(20),
      }).select("id").single();
      await admin.from("consent_records").insert({
        participant_id: ppId, shared_link_id: link?.id,
        purpose: p.first === "Marcus" ? "Employment verification with prospective employer" : "Housing application with sober-living provider",
        recipient_description: p.first === "Marcus" ? "Hiring manager at local employer" : "Admissions coordinator at sober-living residence",
        sections_disclosed: { milestones: true, plan_summary: true, assessment_summary: true, peer_specialist: true },
        consented_at: ago(20),
        expires_at: new Date(now + 30 * DAY).toISOString(),
      });
      // Audit views
      for (let v = 0; v < 4; v++) {
        await admin.from("audit_log").insert({
          user_id: null, action: "view_passport", target_type: "shared_links",
          target_id: link?.id, created_at: ago(18 - v * 4),
        });
      }
    }

    // Referral
    if (p.referral) {
      await admin.from("referrals").insert({
        participant_id: ppId, partner_id: PARTNER_ID, referred_by: p.peer,
        status: "peer_approved",
        notes: `${p.first} is preparing for transition to sober living. Peer-approved; awaiting partner acceptance.`,
        created_at: ago(7),
      });
    }

    // Notifications for participant
    await admin.from("notifications").insert({
      user_id: uid, type: "general", title: "Welcome to Recovery Passport",
      body: "Your card is ready. Tap to see today's focus.", link: "/card",
      created_at: ago(p.daysAgo),
    });
    if (p.milestoneCount > 1) {
      await admin.from("notifications").insert({
        user_id: uid, type: "general", title: "Milestone unlocked!",
        body: `You earned: ${MILESTONES[Math.min(p.milestoneCount - 1, MILESTONES.length - 1)].name}`,
        link: "/milestones",
        is_read: true, read_at: ago(Math.max(0, p.daysAgo - 10)),
        created_at: ago(Math.max(0, p.daysAgo - 10)),
      });
    }
  }

  // ===== Supervisor feedback (admin → peers) =====
  // Get a few of Maria's check-ins and give feedback
  const { data: mariaCheckins } = await admin.from("weekly_checkins").select("id").eq("peer_specialist_id", mariaId).limit(3);
  for (const c of mariaCheckins || []) {
    await admin.from("supervisor_feedback").insert({
      target_type: "checkin" as any, target_id: c.id, supervisor_id: adminUserId,
      feedback: "Excellent documentation and use of reflective listening. Strong example for the team.",
    });
  }
  const { data: danielaNotes } = await admin.from("progress_notes").select("id").eq("author_id", danielaId).eq("note_type", "crisis").limit(1);
  for (const n of danielaNotes || []) {
    await admin.from("supervisor_feedback").insert({
      target_type: "progress_note" as any, target_id: n.id, supervisor_id: adminUserId,
      feedback: "Strong crisis response. Safety planning was thorough. Recommend documenting follow-up timeline more explicitly.",
    });
  }

  // Notifications for peers
  await admin.from("notifications").insert({
    user_id: mariaId, type: "general", title: "New supervisor feedback",
    body: "Pat Reyes left feedback on your recent check-in.", link: "/notifications",
    created_at: ago(2),
  });
  await admin.from("notifications").insert({
    user_id: danielaId, type: "general", title: "Crisis follow-up due",
    body: "Jasmine Rivera 48-hour follow-up scheduled.", link: "/caseload",
    created_at: ago(1),
  });

  // Save user list
  const cfgValue = JSON.stringify(allUserIds);
  if (existing) {
    await admin.from("app_config").update({ value: cfgValue, updated_at: new Date().toISOString() }).eq("key", "demo_user_ids");
  } else {
    await admin.from("app_config").insert({ key: "demo_user_ids", value: cfgValue });
  }

  return json({
    message: "Demo seeded",
    admin: 1, peers: 4, participants: participants.length,
    totalUsers: allUserIds.length,
  });
}
