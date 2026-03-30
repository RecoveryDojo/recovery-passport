import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify caller is admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: userData } = await userClient.from("users").select("role").eq("id", user.id).single();
  if (userData?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { action } = await req.json();

  if (action === "clear") {
    return await clearDemoData(admin);
  }

  if (action === "seed") {
    return await seedDemoData(admin, user.id);
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
});

async function clearDemoData(admin: any) {
  // Get demo user IDs from app_config
  const { data: config } = await admin.from("app_config").select("value").eq("key", "demo_user_ids").single();
  if (!config?.value) {
    return new Response(JSON.stringify({ message: "No demo data found" }), { headers: corsHeaders });
  }

  const userIds: string[] = JSON.parse(config.value);
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ message: "No demo data found" }), { headers: corsHeaders });
  }

  // Get participant profile IDs for these users
  const { data: pProfiles } = await admin.from("participant_profiles").select("id").in("user_id", userIds);
  const ppIds = (pProfiles || []).map((p: any) => p.id);

  // Delete in dependency order
  if (ppIds.length > 0) {
    // Get plan IDs
    const { data: plans } = await admin.from("recovery_plans").select("id").in("participant_id", ppIds);
    const planIds = (plans || []).map((p: any) => p.id);
    if (planIds.length > 0) {
      const { data: phases } = await admin.from("plan_phases").select("id").in("plan_id", planIds);
      const phaseIds = (phases || []).map((p: any) => p.id);
      if (phaseIds.length > 0) {
        await admin.from("plan_action_steps").delete().in("phase_id", phaseIds);
      }
      await admin.from("plan_phases").delete().in("plan_id", planIds);
    }
    await admin.from("recovery_plans").delete().in("participant_id", ppIds);

    // Get assessment session IDs
    const { data: sessions } = await admin.from("assessment_sessions").select("id").in("participant_id", ppIds);
    const sessIds = (sessions || []).map((s: any) => s.id);
    if (sessIds.length > 0) {
      await admin.from("assessment_scores").delete().in("session_id", sessIds);
    }
    await admin.from("assessment_sessions").delete().in("participant_id", ppIds);

    await admin.from("participant_milestones").delete().in("participant_id", ppIds);
    await admin.from("weekly_checkins").delete().in("participant_id", ppIds);
    await admin.from("progress_notes").delete().in("participant_id", ppIds);
    await admin.from("payment_records").delete().in("participant_id", ppIds);
    await admin.from("referrals").delete().in("participant_id", ppIds);
    await admin.from("agreement_acknowledgments").delete().in("participant_id", ppIds);
    await admin.from("consent_records").delete().in("participant_id", ppIds);
    await admin.from("shared_links").delete().in("participant_id", ppIds);
    await admin.from("peer_requests").delete().in("participant_id", ppIds);
    await admin.from("notifications").delete().in("user_id", userIds);
  }

  // Delete CRPS data for peer users
  await admin.from("crps_hours_log").delete().in("peer_specialist_id", userIds);
  await admin.from("crps_competency_milestones").delete().in("peer_specialist_id", userIds);
  await admin.from("self_care_checks").delete().in("peer_specialist_id", userIds);
  await admin.from("supervisor_feedback").delete().in("supervisor_id", userIds);

  // Delete profiles
  await admin.from("participant_profiles").delete().in("user_id", userIds);
  await admin.from("peer_specialist_profiles").delete().in("user_id", userIds);
  await admin.from("users").delete().in("id", userIds);

  // Delete auth users
  for (const uid of userIds) {
    await admin.auth.admin.deleteUser(uid);
  }

  // Clear the config
  await admin.from("app_config").update({ value: "[]" }).eq("key", "demo_user_ids");

  return new Response(JSON.stringify({ message: "Demo data cleared", count: userIds.length }), { headers: corsHeaders });
}

async function seedDemoData(admin: any, adminUserId: string) {
  // Check if demo data already exists
  const { data: existing } = await admin.from("app_config").select("value").eq("key", "demo_user_ids").single();
  if (existing?.value) {
    const existingIds = JSON.parse(existing.value);
    if (existingIds.length > 0) {
      return new Response(JSON.stringify({ error: "Demo data already loaded. Clear it first." }), { status: 400, headers: corsHeaders });
    }
  }

  const allUserIds: string[] = [];
  const demoPassword = "DemoPass123!";

  // Helper to create auth user
  async function createUser(email: string, role: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { role },
    });
    if (error) throw new Error(`Failed to create user ${email}: ${error.message}`);
    allUserIds.push(data.user.id);
    return data.user.id;
  }

  // Get program ID (The Catcher's Mitt)
  const { data: progData } = await admin.from("programs").select("id").limit(1).single();
  const programId = progData?.id;

  // Get milestone definitions
  const { data: milestones } = await admin.from("milestone_definitions").select("id, name, sort_order").order("sort_order");

  // Get assessment domains
  const { data: domains } = await admin.from("assessment_domains").select("id, name").eq("is_active", true).order("sort_order");

  // ===== CREATE PEER SPECIALISTS =====
  const mariaId = await createUser("maria.santos@demo.recoverypassport.org", "peer_specialist");
  const danielaId = await createUser("daniela.cruz@demo.recoverypassport.org", "peer_specialist");

  // Update peer profiles
  await admin.from("peer_specialist_profiles").update({
    first_name: "Maria", last_name: "Santos",
    bio: "Certified CRPS with 2 years of experience supporting individuals in recovery. Specializes in motivational interviewing and crisis de-escalation.",
    specialties: ["Motivational Interviewing", "Crisis De-escalation", "Housing Support"],
    approval_status: "approved", approved_by: adminUserId, approved_at: new Date(Date.now() - 730 * 86400000).toISOString(),
    crps_status: "certified", is_available: true,
  }).eq("user_id", mariaId);

  await admin.from("peer_specialist_profiles").update({
    first_name: "Daniela", last_name: "Cruz",
    bio: "Peer specialist trainee passionate about recovery support. Currently working toward CRPS certification.",
    specialties: ["Recovery Planning", "Resource Navigation"],
    approval_status: "approved", approved_by: adminUserId, approved_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    crps_status: "in_training", is_available: true,
  }).eq("user_id", danielaId);

  // ===== MARIA'S CRPS DATA =====
  // Update competency milestones (auto-seeded by trigger) to demonstrated/verified
  const tools = ["Motivational Interviewing", "Recovery Capital Assessment", "Recovery Management Planning", "Crisis De-escalation", "Resource Navigation & Referral", "Documentation & Progress Notes"];
  for (const tool of tools) {
    await admin.from("crps_competency_milestones").update({
      status: "verified", verified_by: adminUserId, verified_at: new Date(Date.now() - 365 * 86400000).toISOString(),
    }).eq("peer_specialist_id", mariaId).eq("tool_or_skill", tool);
  }
  const skills = ["Advocacy", "Mentoring", "Ethical Boundaries", "Cultural Competence", "Self-Care & Vicarious Trauma", "Recovery Support Planning"];
  for (const skill of skills) {
    await admin.from("crps_competency_milestones").update({
      status: "verified", verified_by: adminUserId, verified_at: new Date(Date.now() - 365 * 86400000).toISOString(),
    }).eq("peer_specialist_id", mariaId).eq("tool_or_skill", skill);
  }

  // Maria's hours (400 work_experience total)
  const mariaHourEntries = [
    { category: "work_experience", hours: 200, source_type: "manual" },
    { category: "work_experience", hours: 200, source_type: "manual" },
    { category: "direct_peer_services", hours: 150, source_type: "manual" },
    { category: "training", hours: 46, source_type: "manual" },
    { category: "supervised_advocacy", hours: 25, source_type: "manual" },
    { category: "supervised_mentoring", hours: 25, source_type: "manual" },
    { category: "supervised_recovery_support", hours: 25, source_type: "manual" },
    { category: "supervised_professional_responsibility", hours: 25, source_type: "manual" },
  ];
  for (const entry of mariaHourEntries) {
    await admin.from("crps_hours_log").insert({
      peer_specialist_id: mariaId, ...entry,
      logged_at: new Date(Date.now() - 180 * 86400000).toISOString(),
    });
  }

  // ===== DANIELA'S CRPS DATA =====
  await admin.from("crps_competency_milestones").update({
    status: "in_progress",
  }).eq("peer_specialist_id", danielaId).eq("tool_or_skill", "Motivational Interviewing");
  await admin.from("crps_competency_milestones").update({
    status: "in_progress",
  }).eq("peer_specialist_id", danielaId).eq("tool_or_skill", "Documentation & Progress Notes");

  const danielaHourEntries = [
    { category: "work_experience", hours: 80, source_type: "manual" },
    { category: "direct_peer_services", hours: 40, source_type: "manual" },
    { category: "training", hours: 46, source_type: "manual" },
  ];
  for (const entry of danielaHourEntries) {
    await admin.from("crps_hours_log").insert({
      peer_specialist_id: danielaId, ...entry,
      logged_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    });
  }

  // ===== CREATE PARTICIPANTS =====
  const marcusId = await createUser("marcus.williams@demo.recoverypassport.org", "participant");
  const jasmineId = await createUser("jasmine.rivera@demo.recoverypassport.org", "participant");
  const devonId = await createUser("devon.carter@demo.recoverypassport.org", "participant");
  const tashaId = await createUser("tasha.monroe@demo.recoverypassport.org", "participant");

  // Update participant profiles
  const now = Date.now();
  const day = 86400000;

  await admin.from("participant_profiles").update({
    first_name: "Marcus", last_name: "Williams",
    recovery_start_date: new Date(now - 180 * day).toISOString().split("T")[0],
    pathway: "twelve_step", current_program_id: programId, assigned_peer_id: mariaId,
    substances: ["Alcohol", "Opioids"],
    card_level: "all_star",
  }).eq("user_id", marcusId);

  await admin.from("participant_profiles").update({
    first_name: "Jasmine", last_name: "Rivera",
    recovery_start_date: new Date(now - 60 * day).toISOString().split("T")[0],
    pathway: "mat", current_program_id: programId, assigned_peer_id: danielaId,
    substances: ["Opioids"],
    card_level: "starter",
  }).eq("user_id", jasmineId);

  await admin.from("participant_profiles").update({
    first_name: "Devon", last_name: "Carter",
    recovery_start_date: new Date(now - 21 * day).toISOString().split("T")[0],
    pathway: "holistic", current_program_id: programId, assigned_peer_id: mariaId,
    substances: ["Methamphetamine"],
    card_level: "rookie",
  }).eq("user_id", devonId);

  await admin.from("participant_profiles").update({
    first_name: "Tasha", last_name: "Monroe",
    recovery_start_date: new Date(now - 1 * day).toISOString().split("T")[0],
    pathway: "other", current_program_id: programId, assigned_peer_id: danielaId,
    substances: ["Alcohol"],
    card_level: "rookie",
  }).eq("user_id", tashaId);

  // Get participant profile IDs
  const { data: ppMarcus } = await admin.from("participant_profiles").select("id").eq("user_id", marcusId).single();
  const { data: ppJasmine } = await admin.from("participant_profiles").select("id").eq("user_id", jasmineId).single();
  const { data: ppDevon } = await admin.from("participant_profiles").select("id").eq("user_id", devonId).single();
  const { data: ppTasha } = await admin.from("participant_profiles").select("id").eq("user_id", tashaId).single();

  // ===== MILESTONES =====
  const msIds = milestones!.map((m: any) => m.id);

  // Marcus: 10 milestones
  for (let i = 0; i < Math.min(10, msIds.length); i++) {
    await admin.from("participant_milestones").insert({
      participant_id: ppMarcus!.id, milestone_id: msIds[i],
      unlocked_by: mariaId, unlocked_at: new Date(now - (170 - i * 15) * day).toISOString(),
      note: "Great progress!",
    });
  }

  // Jasmine: 6 milestones
  for (let i = 0; i < Math.min(6, msIds.length); i++) {
    await admin.from("participant_milestones").insert({
      participant_id: ppJasmine!.id, milestone_id: msIds[i],
      unlocked_by: danielaId, unlocked_at: new Date(now - (55 - i * 8) * day).toISOString(),
    });
  }

  // Devon: 3 milestones
  for (let i = 0; i < Math.min(3, msIds.length); i++) {
    await admin.from("participant_milestones").insert({
      participant_id: ppDevon!.id, milestone_id: msIds[i],
      unlocked_by: mariaId, unlocked_at: new Date(now - (18 - i * 5) * day).toISOString(),
    });
  }

  // Tasha: 1 milestone (Completed Intake)
  await admin.from("participant_milestones").insert({
    participant_id: ppTasha!.id, milestone_id: msIds[0],
    unlocked_by: danielaId, unlocked_at: new Date(now - 1 * day).toISOString(),
    note: "Welcome to the program!",
  });

  // ===== ASSESSMENTS =====
  const domainIds = domains!.map((d: any) => d.id);

  async function createAssessment(participantId: string, initiatedBy: string, daysAgo: number, baseScore: number) {
    const { data: sess } = await admin.from("assessment_sessions").insert({
      participant_id: participantId, initiated_by: initiatedBy,
      overall_score: baseScore, completed_at: new Date(now - daysAgo * day).toISOString(),
    }).select("id").single();

    for (const domId of domainIds) {
      const score = Math.max(1, Math.min(5, Math.round(baseScore + (Math.random() - 0.5) * 1.5)));
      await admin.from("assessment_scores").insert({
        session_id: sess!.id, domain_id: domId, score,
      });
    }
    return sess!.id;
  }

  // Marcus: 3 assessments (2.1 → 3.4 → 4.1)
  await createAssessment(ppMarcus!.id, mariaId, 170, 2.1);
  await createAssessment(ppMarcus!.id, mariaId, 90, 3.4);
  await createAssessment(ppMarcus!.id, mariaId, 14, 4.1);

  // Jasmine: 2 assessments (1.8 → 2.9)
  await createAssessment(ppJasmine!.id, danielaId, 55, 1.8);
  await createAssessment(ppJasmine!.id, danielaId, 10, 2.9);

  // Devon: 1 assessment (2.4)
  await createAssessment(ppDevon!.id, mariaId, 18, 2.4);

  // ===== RECOVERY PLANS =====
  async function createPlan(participantId: string, activePhases: string[]) {
    const { data: plan } = await admin.from("recovery_plans").insert({
      participant_id: participantId, version: 1, is_current: true,
    }).select("id").single();

    const phaseTitles: Record<string, string> = {
      thirty_day: "Phase 1: Physical Stabilization",
      sixty_day: "Phase 2: Recovery Structure",
      ninety_day: "Phase 3: Life Rebuilding",
      six_month: "Phase 4: Recovery-First Lifestyle",
    };

    for (const phase of ["thirty_day", "sixty_day", "ninety_day", "six_month"]) {
      const { data: ph } = await admin.from("plan_phases").insert({
        plan_id: plan!.id, phase, title: phaseTitles[phase],
        is_active: activePhases.includes(phase),
      }).select("id").single();

      const stepCount = phase === "thirty_day" ? 6 : 4;
      for (let i = 0; i < stepCount; i++) {
        const completed = activePhases.includes(phase) && i < stepCount - 1;
        await admin.from("plan_action_steps").insert({
          phase_id: ph!.id, description: `Step ${i + 1} for ${phaseTitles[phase]}`,
          sort_order: i, is_completed: completed,
          completed_at: completed ? new Date(now - (10 - i) * day).toISOString() : null,
        });
      }
    }
  }

  // Marcus: Phase 4 active (all phases active)
  await createPlan(ppMarcus!.id, ["thirty_day", "sixty_day", "ninety_day", "six_month"]);
  // Jasmine: Phase 2 unlocked
  await createPlan(ppJasmine!.id, ["thirty_day", "sixty_day"]);
  // Devon: Phase 1 active with 4 steps complete
  await createPlan(ppDevon!.id, ["thirty_day"]);

  // ===== CHECK-INS =====
  // Marcus: 20+ check-ins
  for (let i = 0; i < 22; i++) {
    await admin.from("weekly_checkins").insert({
      participant_id: ppMarcus!.id, peer_specialist_id: mariaId,
      mood_status: Math.min(5, 3 + Math.floor(i / 8)),
      checkin_date: new Date(now - (170 - i * 7) * day).toISOString().split("T")[0],
      summary: `Weekly check-in #${i + 1}. Marcus continues to make steady progress.`,
      plan_progress_notes: "On track with recovery plan goals.",
      next_steps: "Continue current plan, explore employment options.",
    });
  }

  // Jasmine: 8 check-ins, one with crisis
  for (let i = 0; i < 8; i++) {
    const isCrisis = i === 5;
    await admin.from("weekly_checkins").insert({
      participant_id: ppJasmine!.id, peer_specialist_id: danielaId,
      mood_status: isCrisis ? 1 : Math.min(4, 2 + Math.floor(i / 3)),
      checkin_date: new Date(now - (55 - i * 7) * day).toISOString().split("T")[0],
      summary: isCrisis
        ? "Jasmine reported feeling overwhelmed. Discussed coping strategies and safety planning."
        : `Check-in #${i + 1}. Jasmine is adjusting well to the program.`,
      barriers: isCrisis ? "Housing instability, triggered by family conflict" : null,
      next_steps: isCrisis ? "Follow up within 48 hours. Connect with crisis support." : "Continue with current plan.",
    });
  }

  // Crisis progress note for Jasmine
  await admin.from("progress_notes").insert({
    participant_id: ppJasmine!.id, author_id: danielaId,
    note_type: "crisis",
    content: "Jasmine expressed feelings of being overwhelmed due to housing instability and family conflict. Safety plan reviewed. No immediate danger. Follow-up scheduled within 48 hours. Supervisor notified.",
  });

  // Devon: a few check-ins
  for (let i = 0; i < 3; i++) {
    await admin.from("weekly_checkins").insert({
      participant_id: ppDevon!.id, peer_specialist_id: mariaId,
      mood_status: 3,
      checkin_date: new Date(now - (18 - i * 7) * day).toISOString().split("T")[0],
      summary: `Check-in #${i + 1}. Devon is settling into the routine.`,
    });
  }

  // ===== PAYMENT RECORDS (Devon) =====
  await admin.from("payment_records").insert({
    participant_id: ppDevon!.id, amount: 100, type: "charge",
    recorded_by: adminUserId, description: "Program fee - Week 1",
  });
  await admin.from("payment_records").insert({
    participant_id: ppDevon!.id, amount: 100, type: "charge",
    recorded_by: adminUserId, description: "Program fee - Week 2",
  });
  await admin.from("payment_records").insert({
    participant_id: ppDevon!.id, amount: 50, type: "payment",
    recorded_by: adminUserId, description: "Cash payment received",
  });

  // ===== REFERRAL (Jasmine transition) =====
  const { data: partners } = await admin.from("community_partners").select("id").eq("is_approved", true).limit(1);
  if (partners && partners.length > 0) {
    await admin.from("referrals").insert({
      participant_id: ppJasmine!.id, partner_id: partners[0].id,
      referred_by: danielaId, status: "peer_approved",
      notes: "Jasmine is ready to transition to sober living. Peer approved, awaiting partner acceptance.",
    });
  }

  // ===== SAVE DEMO USER IDS =====
  const configValue = JSON.stringify(allUserIds);
  if (existing) {
    await admin.from("app_config").update({ value: configValue }).eq("key", "demo_user_ids");
  } else {
    await admin.from("app_config").insert({ key: "demo_user_ids", value: configValue });
  }

  return new Response(JSON.stringify({
    message: "Demo data seeded successfully",
    participants: 4,
    peerSpecialists: 2,
    totalUsers: allUserIds.length,
  }), { headers: corsHeaders });
}
