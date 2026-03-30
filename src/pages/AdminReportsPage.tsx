import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, Printer, FileBarChart, Loader2 } from "lucide-react";
import { format, differenceInDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface ReportData {
  participantVolume: {
    totalServed: number;
    newIntakes: number;
    currentlyActive: number;
    totalParticipantDays: number;
  };
  stabilization: {
    stabilizationRate: number;
    connectedToLongTermCare: number;
    avgLengthOfStay: number;
    homelessnessDaysPrevented: number;
  };
  recoveryProgress: {
    avgFirstRc: number | null;
    avgLatestRc: number | null;
    avgImprovement: number | null;
    avgMilestones: number;
    phase1CompletionRate: number;
  };
  workforce: {
    activePeers: number;
    totalCheckins: number;
    avgCheckinsPerParticipantPerMonth: number;
    newCrpsEligible: number;
  };
  referrals: {
    totalReferrals: number;
    byDestType: Record<string, number>;
    byPeer: { name: string; count: number }[];
  };
}

const AdminReportsPage = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [locationFilter, setLocationFilter] = useState("all");
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: programs } = useQuery({
    queryKey: ["programs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id, name");
      return data ?? [];
    },
  });

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Select date range", description: "Both start and end dates are required.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const s = startOfDay(startDate).toISOString();
      const e = endOfDay(endDate).toISOString();
      const periodDays = Math.max(differenceInDays(endDate, startDate), 1);

      // Fetch all participants (filter by program if needed)
      let ppQuery = supabase.from("participant_profiles").select("id, user_id, created_at, assigned_peer_id, current_program_id, recovery_start_date");
      if (locationFilter !== "all") ppQuery = ppQuery.eq("current_program_id", locationFilter);
      const { data: allParticipants } = await ppQuery;
      const participants = allParticipants ?? [];
      const pIds = participants.map(p => p.id);

      // New intakes
      const newIntakes = participants.filter(p => p.created_at >= s && p.created_at <= e);
      const activeParticipants = participants.filter(p => p.assigned_peer_id || p.current_program_id);

      // Participant-days
      let totalParticipantDays = 0;
      for (const p of participants) {
        const pStart = new Date(p.created_at) < startDate ? startDate : new Date(p.created_at);
        const pEnd = endDate;
        const days = Math.max(differenceInDays(pEnd, pStart), 0);
        totalParticipantDays += days;
      }

      // Check-ins in period
      let checkinsQuery = supabase.from("weekly_checkins").select("id, participant_id, peer_specialist_id, checkin_date");
      if (pIds.length > 0) checkinsQuery = checkinsQuery.in("participant_id", pIds);
      checkinsQuery = checkinsQuery.gte("checkin_date", s.split("T")[0]).lte("checkin_date", e.split("T")[0]);
      const { data: checkins } = await checkinsQuery;
      const allCheckins = checkins ?? [];

      // Stabilization: participants with 3+ check-ins
      const checkinCountByP = new Map<string, number>();
      for (const c of allCheckins) {
        checkinCountByP.set(c.participant_id, (checkinCountByP.get(c.participant_id) ?? 0) + 1);
      }
      const stabilized = Array.from(checkinCountByP.values()).filter(c => c >= 3).length;
      const stabilizationRate = newIntakes.length > 0 ? (stabilized / newIntakes.length) * 100 : 0;

      // Referrals
      const { data: allReferrals } = await supabase.from("referrals").select("id, participant_id, partner_id, referred_by, status, created_at, updated_at").gte("created_at", s).lte("created_at", e);
      const refs = allReferrals ?? [];
      const completedRefs = refs.filter(r => r.status === "completed");
      const connectedRate = participants.length > 0 ? (completedRefs.length / participants.length) * 100 : 0;

      // Avg length of stay
      let totalStayDays = 0;
      let stayCount = 0;
      for (const p of participants) {
        const programStart = p.recovery_start_date ?? p.created_at;
        const { data: compRef } = await supabase.from("referrals").select("updated_at").eq("participant_id", p.id).eq("status", "completed").order("updated_at", { ascending: false }).limit(1);
        const exitDate = compRef?.[0]?.updated_at ? new Date(compRef[0].updated_at) : new Date();
        const days = differenceInDays(exitDate, new Date(programStart));
        if (days >= 0) { totalStayDays += days; stayCount++; }
      }
      const avgStay = stayCount > 0 ? totalStayDays / stayCount : 0;

      // Homelessness days prevented
      let homelessDays = 0;
      if (pIds.length > 0) {
        const { data: sessions } = await supabase.from("assessment_sessions").select("id, participant_id, completed_at").in("participant_id", pIds).order("completed_at", { ascending: true });
        if (sessions) {
          const firstSessionByP = new Map<string, string>();
          for (const sess of sessions) {
            if (!firstSessionByP.has(sess.participant_id)) firstSessionByP.set(sess.participant_id, sess.id);
          }
          for (const [pId, sessId] of firstSessionByP) {
            const { data: housingScores } = await supabase.from("assessment_scores").select("score, domain_id").eq("session_id", sessId);
            const { data: domains } = await supabase.from("assessment_domains").select("id, name").ilike("name", "%housing%");
            const housingDomainIds = new Set(domains?.map(d => d.id) ?? []);
            const hasLowHousing = housingScores?.some(sc => housingDomainIds.has(sc.domain_id) && sc.score <= 2);
            if (hasLowHousing) {
              const p = participants.find(pp => pp.id === pId);
              if (p) {
                const pStart = new Date(p.created_at) < startDate ? startDate : new Date(p.created_at);
                homelessDays += Math.max(differenceInDays(endDate, pStart), 0);
              }
            }
          }
        }
      }

      // Recovery Progress
      let avgFirstRc: number | null = null;
      let avgLatestRc: number | null = null;
      let avgImprovement: number | null = null;
      if (pIds.length > 0) {
        const { data: allSessions } = await supabase.from("assessment_sessions").select("participant_id, overall_score, completed_at").not("overall_score", "is", null).in("participant_id", pIds).order("completed_at", { ascending: true });
        if (allSessions && allSessions.length > 0) {
          const byP = new Map<string, number[]>();
          for (const sess of allSessions) {
            if (!byP.has(sess.participant_id)) byP.set(sess.participant_id, []);
            byP.get(sess.participant_id)!.push(Number(sess.overall_score));
          }
          const firsts: number[] = [];
          const latests: number[] = [];
          const improvements: number[] = [];
          for (const [, scores] of byP) {
            if (scores.length >= 2) {
              firsts.push(scores[0]);
              latests.push(scores[scores.length - 1]);
              improvements.push(scores[scores.length - 1] - scores[0]);
            }
          }
          if (firsts.length > 0) {
            avgFirstRc = firsts.reduce((a, b) => a + b, 0) / firsts.length;
            avgLatestRc = latests.reduce((a, b) => a + b, 0) / latests.length;
            avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
          }
        }
      }

      // Avg milestones
      let avgMilestones = 0;
      if (pIds.length > 0) {
        const { data: milestones } = await supabase.from("participant_milestones").select("id").in("participant_id", pIds);
        avgMilestones = participants.length > 0 ? (milestones?.length ?? 0) / participants.length : 0;
      }

      // Phase 1 completion
      let phase1Complete = 0;
      if (pIds.length > 0) {
        const { data: plans } = await supabase.from("recovery_plans").select("id, participant_id").in("participant_id", pIds).eq("is_current", true);
        if (plans) {
          for (const plan of plans) {
            const { data: phases } = await supabase.from("plan_phases").select("id").eq("plan_id", plan.id).eq("phase", "thirty_day");
            if (phases && phases.length > 0) {
              const phaseId = phases[0].id;
              const { data: steps } = await supabase.from("plan_action_steps").select("id, is_completed").eq("phase_id", phaseId);
              if (steps && steps.length > 0) {
                const completedPct = steps.filter(st => st.is_completed).length / steps.length;
                if (completedPct >= 0.8) phase1Complete++;
              }
            }
          }
        }
      }
      const phase1Rate = participants.length > 0 ? (phase1Complete / participants.length) * 100 : 0;

      // Workforce
      const { data: approvedPeers } = await supabase.from("peer_specialist_profiles").select("user_id").eq("approval_status", "approved");
      const activePeers = approvedPeers?.length ?? 0;
      const months = Math.max(periodDays / 30, 1);
      const avgCheckinsPerPPerMonth = participants.length > 0 ? allCheckins.length / participants.length / months : 0;

      // CRPS eligible (peer_specialist_profiles with crps_status changed to 'eligible' - approximate by checking current status)
      const { data: eligiblePeers } = await supabase.from("peer_specialist_profiles").select("user_id").eq("crps_status", "eligible");
      const newCrpsEligible = eligiblePeers?.length ?? 0;

      // Referral breakdowns
      const partnerIds = [...new Set(refs.map(r => r.partner_id))];
      const byDestType: Record<string, number> = {};
      if (partnerIds.length > 0) {
        const { data: partners } = await supabase.from("community_partners").select("id, type").in("id", partnerIds);
        const partnerTypeMap = new Map(partners?.map(p => [p.id, p.type ?? "other"]) ?? []);
        for (const r of refs) {
          const t = (partnerTypeMap.get(r.partner_id) ?? "other").replace(/_/g, " ");
          byDestType[t] = (byDestType[t] ?? 0) + 1;
        }
      }

      const peerRefCount = new Map<string, number>();
      for (const r of refs) peerRefCount.set(r.referred_by, (peerRefCount.get(r.referred_by) ?? 0) + 1);
      const peerIds = Array.from(peerRefCount.keys());
      const byPeer: { name: string; count: number }[] = [];
      if (peerIds.length > 0) {
        const { data: peerProfiles } = await supabase.from("peer_specialist_profiles").select("user_id, first_name, last_name").in("user_id", peerIds);
        const nameMap = new Map(peerProfiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]) ?? []);
        for (const [id, count] of peerRefCount) {
          byPeer.push({ name: nameMap.get(id) ?? "Unknown", count });
        }
        byPeer.sort((a, b) => b.count - a.count);
      }

      const reportData: ReportData = {
        participantVolume: { totalServed: participants.length, newIntakes: newIntakes.length, currentlyActive: activeParticipants.length, totalParticipantDays },
        stabilization: { stabilizationRate, connectedToLongTermCare: connectedRate, avgLengthOfStay: avgStay, homelessnessDaysPrevented: homelessDays },
        recoveryProgress: { avgFirstRc, avgLatestRc, avgImprovement, avgMilestones, phase1CompletionRate: phase1Rate },
        workforce: { activePeers, totalCheckins: allCheckins.length, avgCheckinsPerParticipantPerMonth: avgCheckinsPerPPerMonth, newCrpsEligible },
        referrals: { totalReferrals: refs.length, byDestType, byPeer },
      };

      setReport(reportData);

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user?.id,
        action: "export_report",
        target_type: "report",
        metadata: { date_range_start: s, date_range_end: e, location_filter: locationFilter },
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error generating report", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const exportCsv = async () => {
    if (!startDate || !endDate) return;
    const s = startOfDay(startDate).toISOString();
    const e = endOfDay(endDate).toISOString();

    let ppQuery = supabase.from("participant_profiles").select("id, first_name, last_name, created_at, card_level, assigned_peer_id, current_program_id, recovery_start_date");
    if (locationFilter !== "all") ppQuery = ppQuery.eq("current_program_id", locationFilter);
    const { data: participants } = await ppQuery;
    if (!participants || participants.length === 0) { toast({ title: "No data to export" }); return; }

    const pIds = participants.map(p => p.id);
    const [{ data: milestones }, { data: checkins }, { data: refs }, { data: sessions }] = await Promise.all([
      supabase.from("participant_milestones").select("participant_id").in("participant_id", pIds),
      supabase.from("weekly_checkins").select("participant_id").in("participant_id", pIds).gte("checkin_date", s.split("T")[0]).lte("checkin_date", e.split("T")[0]),
      supabase.from("referrals").select("participant_id, status").in("participant_id", pIds),
      supabase.from("assessment_sessions").select("participant_id, overall_score, completed_at").not("overall_score", "is", null).in("participant_id", pIds).order("completed_at", { ascending: false }),
    ]);

    const milestoneCount = new Map<string, number>();
    milestones?.forEach(m => milestoneCount.set(m.participant_id, (milestoneCount.get(m.participant_id) ?? 0) + 1));
    const checkinCount = new Map<string, number>();
    checkins?.forEach(c => checkinCount.set(c.participant_id, (checkinCount.get(c.participant_id) ?? 0) + 1));
    const latestRc = new Map<string, number>();
    sessions?.forEach(sess => { if (!latestRc.has(sess.participant_id)) latestRc.set(sess.participant_id, Number(sess.overall_score)); });
    const refStatus = new Map<string, string>();
    refs?.forEach(r => { if (!refStatus.has(r.participant_id) || r.status === "completed") refStatus.set(r.participant_id, r.status); });

    const { data: adminUser } = await supabase.from("users").select("email").eq("id", user?.id ?? "").maybeSingle();

    const rows = [["Participant ID", "First Name", "Last Name", "Created At", "Card Level", "Milestones Earned", "Check-ins (Period)", "Latest RC Score", "Referral Status"].join(",")];
    for (const p of participants) {
      rows.push([p.id, `"${p.first_name}"`, `"${p.last_name}"`, p.created_at, p.card_level, milestoneCount.get(p.id) ?? 0, checkinCount.get(p.id) ?? 0, latestRc.get(p.id) ?? "", refStatus.get(p.id) ?? ""].join(","));
    }
    rows.push("");
    rows.push(`"This report was generated by ${adminUser?.email ?? "admin"} on ${format(new Date(), "PPP")}. Per 42 CFR Part 2, individual records may not be re-disclosed without participant consent."`);

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funder-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    await supabase.from("audit_log").insert({
      user_id: user?.id,
      action: "export_report",
      target_type: "csv_export",
      metadata: { date_range_start: s, date_range_end: e, location_filter: locationFilter },
    });
  };

  const printReport = () => window.print();

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="text-center p-3">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <FileBarChart className="h-5 w-5" /> Funder Reports
        </h1>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left text-sm", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left text-sm", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {programs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateReport} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report */}
      {report && (
        <div className="space-y-4" id="report-content">
          {/* Print header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold">Recovery Passport — Funder Report</h1>
            <p className="text-sm text-muted-foreground">
              {startDate && endDate ? `${format(startDate, "MMM d, yyyy")} — ${format(endDate, "MMM d, yyyy")}` : ""}
            </p>
          </div>

          {/* 1. Participant Volume */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">1. Participant Volume</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Total Served" value={report.participantVolume.totalServed} />
                <Stat label="New Intakes" value={report.participantVolume.newIntakes} />
                <Stat label="Currently Active" value={report.participantVolume.currentlyActive} />
                <Stat label="Participant-Days" value={report.participantVolume.totalParticipantDays.toLocaleString()} />
              </div>
            </CardContent>
          </Card>

          {/* 2. Stabilization */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">2. Stabilization & Outcomes</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Stabilization Rate" value={`${report.stabilization.stabilizationRate.toFixed(0)}%`} />
                <Stat label="Connected to Long-term Care" value={`${report.stabilization.connectedToLongTermCare.toFixed(0)}%`} />
                <Stat label="Avg Length of Stay" value={`${report.stabilization.avgLengthOfStay.toFixed(0)} days`} />
                <Stat label="Homelessness Days Prevented" value={report.stabilization.homelessnessDaysPrevented.toLocaleString()} />
              </div>
            </CardContent>
          </Card>

          {/* 3. Recovery Progress */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">3. Recovery Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Stat label="Avg First RC Score" value={report.recoveryProgress.avgFirstRc !== null ? report.recoveryProgress.avgFirstRc.toFixed(1) : "—"} />
                <Stat label="Avg Latest RC Score" value={report.recoveryProgress.avgLatestRc !== null ? report.recoveryProgress.avgLatestRc.toFixed(1) : "—"} />
                <Stat label="Avg Improvement" value={report.recoveryProgress.avgImprovement !== null ? `+${report.recoveryProgress.avgImprovement.toFixed(1)}` : "—"} />
                <Stat label="Avg Milestones/Participant" value={report.recoveryProgress.avgMilestones.toFixed(1)} />
                <Stat label="Phase 1 Completion" value={`${report.recoveryProgress.phase1CompletionRate.toFixed(0)}%`} />
              </div>
            </CardContent>
          </Card>

          {/* 4. Workforce */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">4. Workforce</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Active Peer Specialists" value={report.workforce.activePeers} />
                <Stat label="Total Check-ins" value={report.workforce.totalCheckins} />
                <Stat label="Avg Check-ins/Participant/Mo" value={report.workforce.avgCheckinsPerParticipantPerMonth.toFixed(1)} />
                <Stat label="CRPS Eligible" value={report.workforce.newCrpsEligible} />
              </div>
            </CardContent>
          </Card>

          {/* 5. Referrals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">5. Referrals & Transitions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Stat label="Total Referrals in Period" value={report.referrals.totalReferrals} />

              {Object.keys(report.referrals.byDestType).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">By Destination Type</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(report.referrals.byDestType).map(([type, count]) => (
                      <Badge key={type} variant="secondary" className="capitalize">{type}: {count}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {report.referrals.byPeer.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Top Referrers</p>
                  <div className="space-y-1">
                    {report.referrals.byPeer.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{p.name}</span>
                        <span className="font-medium">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export buttons */}
          <div className="flex gap-3 print:hidden">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export as CSV
            </Button>
            <Button variant="outline" onClick={printReport}>
              <Printer className="h-4 w-4 mr-2" /> Print Summary
            </Button>
          </div>
        </div>
      )}

      {!report && !generating && (
        <div className="text-center py-16 text-muted-foreground">
          <FileBarChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a date range and generate your report.</p>
        </div>
      )}
    </div>
  );
};

export default AdminReportsPage;
