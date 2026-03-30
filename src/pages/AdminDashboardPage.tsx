import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Target, BarChart2, ArrowRightLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import DemoControls from "@/components/DemoControls";

interface MetricCard {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}

interface AlertItem {
  id: string;
  type: "overdue_checkin" | "crisis_note" | "pending_assessment" | "pending_peer";
  severity: "red" | "amber" | "blue" | "purple";
  text: string;
  link?: string;
}

interface PeerOverview {
  userId: string;
  name: string;
  photoUrl: string | null;
  caseloadCount: number;
  complianceRate: number;
  crpsProgress: number;
  lastActivity: string | null;
}

interface ProgramSummary {
  id: string;
  name: string;
  activeCount: number;
  avgRc: number | null;
  milestoneRate: number;
}

const AdminDashboardPage = () => {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [peers, setPeers] = useState<PeerOverview[]>([]);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      await Promise.all([loadMetrics(), loadAlerts(), loadPeers(), loadPrograms()]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    // Active participants
    const { data: activeP } = await supabase
      .from("participant_profiles")
      .select("id")
      .or("assigned_peer_id.not.is.null,current_program_id.not.is.null");
    const activeCount = activeP?.length ?? 0;

    // Milestone completion rate
    const { data: allMilestones } = await supabase
      .from("participant_milestones")
      .select("id");
    const milestoneCount = allMilestones?.length ?? 0;
    const milestoneRate = activeCount > 0 ? ((milestoneCount / (activeCount * 12)) * 100) : 0;

    // Avg RC score (most recent per participant)
    const { data: sessions } = await supabase
      .from("assessment_sessions")
      .select("participant_id, overall_score, completed_at, confirmed_by")
      .not("confirmed_by", "is", null)
      .not("overall_score", "is", null)
      .order("completed_at", { ascending: false });

    let avgRc = 0;
    if (sessions && sessions.length > 0) {
      const latestByParticipant = new Map<string, number>();
      for (const s of sessions) {
        if (!latestByParticipant.has(s.participant_id)) {
          latestByParticipant.set(s.participant_id, Number(s.overall_score));
        }
      }
      const scores = Array.from(latestByParticipant.values());
      avgRc = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    // Transition success rate
    const { data: allReferrals } = await supabase.from("referrals").select("id, status");
    const totalRef = allReferrals?.length ?? 0;
    const completedRef = allReferrals?.filter(r => r.status === "completed").length ?? 0;
    const transitionRate = totalRef > 0 ? ((completedRef / totalRef) * 100) : 0;

    setMetrics([
      { label: "Active Participants", value: String(activeCount), icon: Users },
      { label: "Milestone Completion", value: `${milestoneRate.toFixed(0)}%`, icon: Target, sub: `${milestoneCount} earned` },
      { label: "Average RC Score", value: `${avgRc.toFixed(1)} / 5.0`, icon: BarChart2 },
      { label: "Transition Success", value: `${transitionRate.toFixed(0)}%`, icon: ArrowRightLeft, sub: `${completedRef}/${totalRef}` },
    ]);
  };

  const loadAlerts = async () => {
    const items: AlertItem[] = [];

    // Overdue check-ins
    const { data: activeParticipants } = await supabase
      .from("participant_profiles")
      .select("id, first_name, last_name, assigned_peer_id")
      .or("assigned_peer_id.not.is.null,current_program_id.not.is.null");

    if (activeParticipants) {
      for (const p of activeParticipants) {
        const { data: lastCheckin } = await supabase
          .from("weekly_checkins")
          .select("checkin_date")
          .eq("participant_id", p.id)
          .order("checkin_date", { ascending: false })
          .limit(1);

        const lastDate = lastCheckin?.[0]?.checkin_date;
        const days = lastDate ? differenceInDays(new Date(), new Date(lastDate)) : 999;

        if (days >= 7) {
          let peerName = "Unassigned";
          if (p.assigned_peer_id) {
            const { data: peer } = await supabase
              .from("peer_specialist_profiles")
              .select("first_name, last_name")
              .eq("user_id", p.assigned_peer_id)
              .maybeSingle();
            if (peer) peerName = `${peer.first_name} ${peer.last_name}`;
          }
          items.push({
            id: `checkin-${p.id}`,
            type: "overdue_checkin",
            severity: days >= 14 ? "red" : "amber",
            text: `${p.first_name} ${p.last_name} — ${days === 999 ? "No check-ins" : `${days} days since last check-in`} — Peer: ${peerName}`,
          });
        }
      }
    }

    // Crisis notes pending review
    const { data: crisisNotes } = await supabase
      .from("progress_notes")
      .select("id, participant_id, author_id, created_at")
      .eq("note_type", "crisis")
      .order("created_at", { ascending: false });

    if (crisisNotes) {
      const { data: feedbacks } = await supabase
        .from("supervisor_feedback")
        .select("target_id")
        .eq("target_type", "progress_note");
      const reviewedIds = new Set(feedbacks?.map(f => f.target_id) ?? []);

      for (const note of crisisNotes) {
        if (!reviewedIds.has(note.id)) {
          const { data: pp } = await supabase.from("participant_profiles").select("first_name, last_name").eq("id", note.participant_id).maybeSingle();
          const { data: peer } = await supabase.from("peer_specialist_profiles").select("first_name, last_name").eq("user_id", note.author_id).maybeSingle();
          items.push({
            id: `crisis-${note.id}`,
            type: "crisis_note",
            severity: "red",
            text: `${pp?.first_name ?? ""} ${pp?.last_name ?? ""} — Crisis note by ${peer?.first_name ?? ""} ${peer?.last_name ?? ""} on ${format(new Date(note.created_at), "MMM d")}`,
          });
        }
      }
    }

    // Pending assessments (>48h, unconfirmed)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: pendingAssessments } = await supabase
      .from("assessment_sessions")
      .select("id, participant_id, created_at")
      .is("confirmed_by", null)
      .lt("created_at", cutoff);

    if (pendingAssessments) {
      for (const a of pendingAssessments) {
        const { data: pp } = await supabase.from("participant_profiles").select("first_name, last_name").eq("id", a.participant_id).maybeSingle();
        items.push({
          id: `assess-${a.id}`,
          type: "pending_assessment",
          severity: "blue",
          text: `${pp?.first_name ?? ""} ${pp?.last_name ?? ""} — assessment awaiting review`,
        });
      }
    }

    // Pending peer approvals
    const { data: pendingPeers } = await supabase
      .from("peer_specialist_profiles")
      .select("id, first_name, last_name")
      .eq("approval_status", "pending");

    if (pendingPeers) {
      for (const p of pendingPeers) {
        items.push({
          id: `peer-${p.id}`,
          type: "pending_peer",
          severity: "purple",
          text: `${p.first_name} ${p.last_name} — pending peer specialist approval`,
          link: "/admin/peers/review",
        });
      }
    }

    // Sort: red first, then amber, blue, purple
    const order = { red: 0, amber: 1, blue: 2, purple: 3 };
    items.sort((a, b) => order[a.severity] - order[b.severity]);
    setAlerts(items);
  };

  const loadPeers = async () => {
    const { data: approvedPeers } = await supabase
      .from("peer_specialist_profiles")
      .select("user_id, first_name, last_name, photo_url")
      .eq("approval_status", "approved");

    if (!approvedPeers) { setPeers([]); return; }

    const results: PeerOverview[] = [];
    for (const p of approvedPeers) {
      // Caseload
      const { data: caseload } = await supabase
        .from("participant_profiles")
        .select("id")
        .eq("assigned_peer_id", p.user_id);
      const caseloadCount = caseload?.length ?? 0;

      // Compliance: participants with checkin in last 7 days
      let complianceRate = 0;
      if (caseloadCount > 0 && caseload) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        let compliant = 0;
        for (const part of caseload) {
          const { data: recent } = await supabase
            .from("weekly_checkins")
            .select("id")
            .eq("participant_id", part.id)
            .gte("checkin_date", sevenDaysAgo)
            .limit(1);
          if (recent && recent.length > 0) compliant++;
        }
        complianceRate = (compliant / caseloadCount) * 100;
      }

      // CRPS progress
      const { data: competencies } = await supabase
        .from("crps_competency_milestones")
        .select("status")
        .eq("peer_specialist_id", p.user_id);
      let crpsProgress = 0;
      if (competencies && competencies.length > 0) {
        const statusPoints: Record<string, number> = { not_started: 0, in_progress: 0.33, demonstrated: 0.66, verified: 1 };
        const total = competencies.reduce((sum, c) => sum + (statusPoints[c.status] ?? 0), 0);
        crpsProgress = (total / competencies.length) * 100;
      }

      // Last activity (most recent checkin or note)
      const { data: lastCheckin } = await supabase
        .from("weekly_checkins")
        .select("created_at")
        .eq("peer_specialist_id", p.user_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: lastNote } = await supabase
        .from("progress_notes")
        .select("created_at")
        .eq("author_id", p.user_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const dates = [lastCheckin?.[0]?.created_at, lastNote?.[0]?.created_at].filter(Boolean) as string[];
      const lastActivity = dates.length > 0 ? dates.sort().reverse()[0] : null;

      results.push({
        userId: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim() || "Unnamed",
        photoUrl: p.photo_url,
        caseloadCount,
        complianceRate,
        crpsProgress,
        lastActivity,
      });
    }
    setPeers(results);
  };

  const loadPrograms = async () => {
    const { data: allPrograms } = await supabase.from("programs").select("id, name");
    if (!allPrograms) { setPrograms([]); return; }

    const results: ProgramSummary[] = [];
    for (const prog of allPrograms) {
      const { data: participants } = await supabase
        .from("participant_profiles")
        .select("id")
        .eq("current_program_id", prog.id);
      const activeCount = participants?.length ?? 0;

      // Avg RC
      let avgRc: number | null = null;
      if (activeCount > 0 && participants) {
        const pIds = participants.map(p => p.id);
        const { data: sessions } = await supabase
          .from("assessment_sessions")
          .select("participant_id, overall_score, completed_at")
          .not("overall_score", "is", null)
          .in("participant_id", pIds)
          .order("completed_at", { ascending: false });

        if (sessions && sessions.length > 0) {
          const latest = new Map<string, number>();
          for (const s of sessions) {
            if (!latest.has(s.participant_id)) latest.set(s.participant_id, Number(s.overall_score));
          }
          const scores = Array.from(latest.values());
          avgRc = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      }

      // Milestone rate
      let milestoneRate = 0;
      if (activeCount > 0 && participants) {
        const pIds = participants.map(p => p.id);
        const { data: milestones } = await supabase
          .from("participant_milestones")
          .select("id")
          .in("participant_id", pIds);
        milestoneRate = ((milestones?.length ?? 0) / (activeCount * 12)) * 100;
      }

      results.push({ id: prog.id, name: prog.name, activeCount, avgRc, milestoneRate });
    }
    setPrograms(results);
  };

  const severityColor = (s: AlertItem["severity"]) => {
    switch (s) {
      case "red": return "bg-destructive/10 text-destructive border-destructive/20";
      case "amber": return "bg-amber-50 text-amber-800 border-amber-200";
      case "blue": return "bg-blue-50 text-blue-800 border-blue-200";
      case "purple": return "bg-purple-50 text-purple-800 border-purple-200";
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold text-primary">Operations Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Card key={i} className="animate-pulse h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-primary">Operations Dashboard</h1>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
              {m.sub && <p className="text-xs text-muted-foreground">{m.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Items Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">All clear — no items need attention</span>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`text-sm p-3 rounded-lg border cursor-pointer hover:opacity-80 ${severityColor(a.severity)}`}
                  onClick={() => a.link && navigate(a.link)}
                >
                  {a.text}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peer Specialist Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Peer Specialist Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {peers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved peer specialists yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Peer Specialist</th>
                    <th className="pb-2 font-medium text-center">Caseload</th>
                    <th className="pb-2 font-medium text-center">Check-in Compliance</th>
                    <th className="pb-2 font-medium text-center">CRPS Progress</th>
                    <th className="pb-2 font-medium text-right">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((p) => (
                    <tr
                      key={p.userId}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        const peerProfile = peers.find(peer => peer.userId === p.userId);
                        if (peerProfile) navigate(`/admin/peers/${p.userId}`);
                      }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.photoUrl ?? undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {p.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="text-center">{p.caseloadCount}</td>
                      <td className="text-center">
                        <Badge variant={p.complianceRate >= 80 ? "default" : p.complianceRate >= 50 ? "secondary" : "destructive"} className="text-xs">
                          {p.complianceRate.toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(p.crpsProgress, 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{p.crpsProgress.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="text-right text-muted-foreground">
                        {p.lastActivity ? format(new Date(p.lastActivity), "MMM d") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Program Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Program Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No programs found.</p>
          ) : (
            <div className="space-y-3">
              {programs.map((prog) => (
                <div key={prog.id} className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-[140px]">
                    <p className="font-medium text-sm">{prog.name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{prog.activeCount}</p>
                    <p className="text-xs text-muted-foreground">Participants</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{prog.avgRc !== null ? `${prog.avgRc.toFixed(1)}` : "—"}</p>
                    <p className="text-xs text-muted-foreground">Avg RC</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{prog.milestoneRate.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">Milestones</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DemoControls />
    </div>
  );
};

export default AdminDashboardPage;
