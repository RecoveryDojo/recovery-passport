import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Award, CalendarCheck, TrendingUp, Users, ClipboardList, CheckCircle2 } from "lucide-react";

const MOOD_COLORS = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-teal-500", "bg-green-500"];

const LEVEL_STYLES: Record<string, { bg: string; label: string }> = {
  rookie: { bg: "bg-gray-200 text-gray-700", label: "Rookie" },
  starter: { bg: "bg-blue-100 text-blue-700", label: "Starter" },
  veteran: { bg: "bg-amber-100 text-amber-700", label: "Veteran" },
  all_star: { bg: "bg-yellow-200 text-yellow-800", label: "⭐ All-Star" },
};

type LinkData = {
  id: string;
  participant_id: string;
  visible_sections: Record<string, boolean>;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
};

type Status = "loading" | "not_found" | "revoked" | "expired" | "valid";

const PublicPassportPage = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [planPhases, setPlanPhases] = useState<any[]>([]);
  const [peerVerifications, setPeerVerifications] = useState<any[]>([]);
  const [redisclosure, setRedisclosure] = useState("");

  useEffect(() => {
    if (!token) { setStatus("not_found"); return; }

    (async () => {
      // Validate token via RPC
      const { data } = await supabase.rpc("get_shared_link_by_token", { p_token: token });
      if (!data || data.length === 0) { setStatus("not_found"); return; }

      const link = data[0] as unknown as LinkData;
      if (link.is_revoked) { setStatus("revoked"); return; }
      if (link.expires_at && new Date(link.expires_at) < new Date()) { setStatus("expired"); return; }

      setLinkData(link);
      setStatus("valid");

      // Log view
      await supabase.rpc("log_passport_view", { p_token: token });

      const pid = link.participant_id;
      const sections = link.visible_sections ?? {};

      // Always load profile
      const { data: prof } = await supabase
        .from("participant_profiles")
        .select("first_name, last_name, card_level, recovery_start_date, current_program_id, photo_url")
        .eq("id", pid)
        .single();
      setProfile(prof);

      // Program name
      if (sections.current_program && prof?.current_program_id) {
        const { data: prog } = await supabase.from("programs").select("name").eq("id", prof.current_program_id).single();
        setProgram(prog?.name ?? null);
      }

      // Milestones
      if (sections.milestones) {
        const { data: ms } = await supabase
          .from("participant_milestones")
          .select("unlocked_at, unlocked_by, milestone_id")
          .eq("participant_id", pid)
          .order("unlocked_at", { ascending: false });
        if (ms && ms.length > 0) {
          const mIds = [...new Set(ms.map((m) => m.milestone_id))];
          const peerIds = [...new Set(ms.map((m) => m.unlocked_by))];
          const [{ data: defs }, { data: peers }] = await Promise.all([
            supabase.from("milestone_definitions").select("id, name").in("id", mIds),
            supabase.from("peer_specialist_profiles").select("user_id, first_name, last_name").in("user_id", peerIds),
          ]);
          const defMap = Object.fromEntries((defs ?? []).map((d) => [d.id, d.name]));
          const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]));
          setMilestones(ms.map((m) => ({
            name: defMap[m.milestone_id] ?? "Milestone",
            date: m.unlocked_at,
            verifiedBy: peerMap[m.unlocked_by] ?? "Staff",
          })));
        }
      }

      // RC Score Trend
      if (sections.rc_score_trend) {
        const { data: sessions } = await supabase
          .from("assessment_sessions")
          .select("id, completed_at, overall_score")
          .eq("participant_id", pid)
          .order("completed_at", { ascending: true });
        setAssessments(sessions ?? []);
      }

      // Peer Verifications
      if (sections.peer_verifications) {
        const { data: ms } = await supabase
          .from("participant_milestones")
          .select("unlocked_by")
          .eq("participant_id", pid);
        if (ms && ms.length > 0) {
          const counts: Record<string, number> = {};
          ms.forEach((m) => { counts[m.unlocked_by] = (counts[m.unlocked_by] || 0) + 1; });
          const peerIds = Object.keys(counts);
          const { data: peers } = await supabase
            .from("peer_specialist_profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", peerIds);
          const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]));
          setPeerVerifications(peerIds.map((id) => ({ name: peerMap[id] ?? "Staff", count: counts[id] })));
        }
      }

      // Check-in History
      if (sections.checkin_history) {
        const { data: ci } = await supabase
          .from("weekly_checkins")
          .select("checkin_date, mood_status")
          .eq("participant_id", pid)
          .order("checkin_date", { ascending: false })
          .limit(20);
        setCheckins(ci ?? []);
      }

      // Plan Progress
      if (sections.plan_progress) {
        const { data: plans } = await supabase
          .from("recovery_plans")
          .select("id")
          .eq("participant_id", pid)
          .eq("is_current", true)
          .single();
        if (plans) {
          const { data: phases } = await supabase
            .from("plan_phases")
            .select("id, title, phase")
            .eq("plan_id", plans.id)
            .order("created_at");
          if (phases && phases.length > 0) {
            const phaseIds = phases.map((p) => p.id);
            const { data: steps } = await supabase
              .from("plan_action_steps")
              .select("phase_id, is_completed")
              .in("phase_id", phaseIds);
            const stepsByPhase: Record<string, { total: number; done: number }> = {};
            (steps ?? []).forEach((s) => {
              if (!stepsByPhase[s.phase_id]) stepsByPhase[s.phase_id] = { total: 0, done: 0 };
              stepsByPhase[s.phase_id].total++;
              if (s.is_completed) stepsByPhase[s.phase_id].done++;
            });
            setPlanPhases(phases.map((p) => {
              const s = stepsByPhase[p.id] ?? { total: 0, done: 0 };
              return { title: p.title, pct: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0 };
            }));
          }
        }
      }

      // Redisclosure
      const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "cfr42_redisclosure_notice").single();
      setRedisclosure(cfg?.value ?? "");
    })();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading passport…</p>
      </div>
    );
  }

  if (status !== "valid") {
    const messages: Record<string, string> = {
      not_found: "This passport link doesn't exist.",
      revoked: "This link has been revoked by the participant.",
      expired: "This link has expired.",
    };
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <Shield className="h-12 w-12 text-primary mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">{messages[status]}</h1>
        <p className="text-sm text-muted-foreground mt-6">Recovery Epicenter Foundation</p>
      </div>
    );
  }

  if (!profile) return null;

  const sections = linkData!.visible_sections;
  const daysInRecovery = profile.recovery_start_date
    ? differenceInDays(new Date(), new Date(profile.recovery_start_date))
    : null;
  const level = LEVEL_STYLES[profile.card_level] ?? LEVEL_STYLES.rookie;
  const initials = `${(profile.first_name || "")[0] ?? ""}${(profile.last_name || "")[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 print:px-0 print:py-4">
        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold print:text-black">
            Recovery Passport
          </p>

          {/* Avatar */}
          <div className="flex justify-center">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {initials}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground print:text-black">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <Shield className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Verified by Recovery Epicenter Foundation
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Badge className={`${level.bg} border-0 text-sm px-3 py-1`}>{level.label}</Badge>
            {daysInRecovery !== null && daysInRecovery > 0 && (
              <div className="text-center">
                <span className="text-3xl font-bold text-primary">{daysInRecovery}</span>
                <span className="text-sm text-muted-foreground ml-1.5">days in recovery</span>
              </div>
            )}
          </div>

          {sections.current_program && program && (
            <p className="text-sm text-muted-foreground">
              Current Program: <span className="font-medium text-foreground">{program}</span>
            </p>
          )}
        </div>

        <Separator />

        {/* Milestones */}
        {sections.milestones && milestones.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-accent" /> Milestones Earned
            </h2>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.date), "MMM d, yyyy")} · Verified by {m.verifiedBy}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* RC Score Trend */}
        {sections.rc_score_trend && assessments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-accent" /> Recovery Capital Score Trend
            </h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-2xl font-bold text-primary mb-2">
                {assessments[assessments.length - 1].overall_score?.toFixed(1) ?? "—"}
                <span className="text-sm font-normal text-muted-foreground ml-1">current</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                {assessments.map((a, i) => (
                  <span key={a.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-accent">→</span>}
                    <span className="text-foreground font-medium">{a.overall_score?.toFixed(1) ?? "—"}</span>
                    <span className="text-xs">({format(new Date(a.completed_at), "MMM d")})</span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Peer Verifications */}
        {sections.peer_verifications && peerVerifications.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-accent" /> Peer Specialist Verifications
            </h2>
            <div className="space-y-2">
              {peerVerifications.map((pv, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-foreground">
                      Verification by {pv.name}, Peer Specialist
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recovery Epicenter Foundation · {pv.count} item{pv.count !== 1 ? "s" : ""} verified
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Check-In History */}
        {sections.checkin_history && checkins.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
              <CalendarCheck className="h-5 w-5 text-accent" /> Check-In History
            </h2>
            <div className="flex flex-wrap gap-2">
              {checkins.map((ci, i) => (
                <div key={i} className="flex flex-col items-center gap-1" title={`Mood: ${ci.mood_status}/5`}>
                  <div className={`h-4 w-4 rounded-full ${MOOD_COLORS[ci.mood_status] || "bg-muted"}`} />
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(ci.checkin_date), "M/d")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Plan Progress */}
        {sections.plan_progress && planPhases.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
              <ClipboardList className="h-5 w-5 text-accent" /> Recovery Plan Progress
            </h2>
            <div className="space-y-3">
              {planPhases.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{p.title}</span>
                    <span className="text-muted-foreground">{p.pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <Separator />
        <footer className="text-center space-y-2 pb-8 print:pb-2">
          <p className="text-xs text-muted-foreground">
            Generated on {format(new Date(linkData!.created_at), "MMMM d, yyyy")}
          </p>
          {redisclosure && (
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              This information was shared voluntarily by the participant. {redisclosure}
            </p>
          )}
          <p className="text-xs font-semibold text-primary print:text-black">
            Recovery Epicenter Foundation
          </p>
        </footer>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
          .print\\:pb-2 { padding-bottom: 0.5rem !important; }
        }
      `}</style>
    </div>
  );
};

export default PublicPassportPage;
