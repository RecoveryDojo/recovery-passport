import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Clock, Play, Award, ShieldCheck, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type HourCategory = Database["public"]["Enums"]["crps_hour_category"];

const HOUR_REQUIREMENTS: { category: HourCategory; label: string; required: number; sub?: boolean }[] = [
  { category: "training", label: "Training Hours", required: 40 },
  { category: "work_experience", label: "Work Experience", required: 500 },
  { category: "direct_peer_services", label: "Direct Peer Services", required: 250 },
  { category: "supervised_advocacy", label: "Advocacy", required: 4, sub: true },
  { category: "supervised_mentoring", label: "Mentoring", required: 6, sub: true },
  { category: "supervised_recovery_support", label: "Recovery Support", required: 6, sub: true },
  { category: "supervised_professional_responsibility", label: "Professional Responsibility", required: 4, sub: true },
];

const CATEGORY_LABELS: Record<string, string> = {
  training: "Training",
  work_experience: "Work Experience",
  direct_peer_services: "Direct Peer Services",
  supervised_advocacy: "Supervised: Advocacy",
  supervised_mentoring: "Supervised: Mentoring",
  supervised_recovery_support: "Supervised: Recovery Support",
  supervised_professional_responsibility: "Supervised: Prof. Responsibility",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <Play className="h-4 w-4" /> },
  demonstrated: { label: "Demonstrated", color: "bg-blue-100 text-blue-700", icon: <Award className="h-4 w-4" /> },
  verified: { label: "Verified", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-4 w-4" /> },
};

const AdminPeerDetailPage = () => {
  const { peerId } = useParams<{ peerId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: peerProfile } = useQuery({
    queryKey: ["admin-peer-profile", peerId],
    enabled: !!peerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("*")
        .eq("user_id", peerId!)
        .single();
      return data;
    },
  });

  const { data: hourTotals = {} } = useQuery({
    queryKey: ["admin-peer-hours", peerId],
    enabled: !!peerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("crps_hours_log")
        .select("category, hours")
        .eq("peer_specialist_id", peerId!);
      const totals: Record<string, number> = {};
      (data ?? []).forEach((r) => { totals[r.category] = (totals[r.category] || 0) + Number(r.hours); });
      return totals;
    },
  });

  const { data: competencies = [] } = useQuery({
    queryKey: ["admin-peer-competencies", peerId],
    enabled: !!peerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("crps_competency_milestones")
        .select("*")
        .eq("peer_specialist_id", peerId!);
      return data ?? [];
    },
  });

  const { data: pendingHours = [] } = useQuery({
    queryKey: ["admin-peer-pending-hours", peerId],
    enabled: !!peerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("crps_hours_log")
        .select("id, category, hours, source_type, logged_at")
        .eq("peer_specialist_id", peerId!)
        .eq("source_type", "manual")
        .is("verified_by", null)
        .order("logged_at", { ascending: false });
      return data ?? [];
    },
  });

  const verifyCompetencyMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from("crps_competency_milestones")
        .update({ status: "verified", verified_by: user!.id, verified_at: new Date().toISOString() })
        .eq("id", milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Competency verified");
      queryClient.invalidateQueries({ queryKey: ["admin-peer-competencies", peerId] });
    },
    onError: () => toast.error("Failed to verify"),
  });

  const verifyHoursMutation = useMutation({
    mutationFn: async (hourId: string) => {
      const { error } = await supabase
        .from("crps_hours_log")
        .update({ verified_by: user!.id })
        .eq("id", hourId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hours verified");
      queryClient.invalidateQueries({ queryKey: ["admin-peer-pending-hours", peerId] });
      queryClient.invalidateQueries({ queryKey: ["admin-peer-hours", peerId] });
    },
    onError: () => toast.error("Failed to verify"),
  });

  // Last self-care date (admin only sees date, not details)
  const { data: lastSelfCareDate } = useQuery({
    queryKey: ["admin-peer-selfcare", peerId],
    enabled: !!peerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("self_care_checks")
        .select("created_at")
        .eq("peer_specialist_id", peerId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at ?? null;
    },
  });

  const peerName = peerProfile ? `${peerProfile.first_name} ${peerProfile.last_name}` : "Peer Specialist";
  const selfCareOverdue = !lastSelfCareDate || differenceInDays(new Date(), new Date(lastSelfCareDate)) > 14;
  const tools = competencies.filter((c) => c.type === "tool");
  const skills = competencies.filter((c) => c.type === "skill");
  const demonstratedItems = competencies.filter((c) => c.status === "demonstrated");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/peers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{peerName}</h1>
          <p className="text-sm text-muted-foreground">CRPS Certification Progress</p>
          <p className={`text-xs mt-0.5 ${selfCareOverdue ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
            {selfCareOverdue
              ? "⚠️ Self-care check overdue (14+ days)"
              : `Self-care check: last completed ${format(new Date(lastSelfCareDate!), "MMM d, yyyy")}`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="verify">
            Verify {demonstratedItems.length + pendingHours.length > 0 && (
              <Badge className="ml-1 bg-accent text-accent-foreground text-[10px] h-4 px-1">
                {demonstratedItems.length + pendingHours.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6 mt-4">
          {/* Hours */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Hours Progress</h2>
            {HOUR_REQUIREMENTS.map((req) => {
              const current = hourTotals[req.category] || 0;
              const pct = Math.min(Math.round((current / req.required) * 100), 100);
              const complete = current >= req.required;
              return (
                <div key={req.category} className={req.sub ? "pl-4" : ""}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{req.sub && "↳ "}{req.label}</span>
                    <span className={`font-mono text-xs ${complete ? "text-green-600" : "text-muted-foreground"}`}>
                      {current.toFixed(1)} / {req.required}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${complete ? "bg-green-500" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Tools */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6 Tools</h2>
            {tools.map((t) => {
              const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.not_started;
              return (
                <Card key={t.id} className="border-border">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t.tool_or_skill}</span>
                    <Badge className={`${cfg.color} border-0 gap-1`}>{cfg.icon} {cfg.label}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {/* Skills */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6 Skills</h2>
            {skills.map((s) => {
              const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.not_started;
              return (
                <Card key={s.id} className="border-border">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{s.tool_or_skill}</span>
                    <Badge className={`${cfg.color} border-0 gap-1`}>{cfg.icon} {cfg.label}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </TabsContent>

        <TabsContent value="verify" className="space-y-6 mt-4">
          {/* Competencies to verify */}
          {demonstratedItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Competencies Ready to Verify</h2>
              {demonstratedItems.map((c) => (
                <Card key={c.id} className="border-blue-200 bg-blue-50/30">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.tool_or_skill}</p>
                      <p className="text-xs text-muted-foreground capitalize">{c.type}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => verifyCompetencyMutation.mutate(c.id)}
                      disabled={verifyCompetencyMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <ShieldCheck className="h-4 w-4 mr-1" /> Verify
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {/* Pending manual hours */}
          {pendingHours.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Manual Hours Pending Verification</h2>
              {pendingHours.map((h) => (
                <Card key={h.id} className="border-amber-200 bg-amber-50/30">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {CATEGORY_LABELS[h.category] ?? h.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(h.hours).toFixed(1)} hrs · {format(new Date(h.logged_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => verifyHoursMutation.mutate(h.id)}
                      disabled={verifyHoursMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Verify
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {demonstratedItems.length === 0 && pendingHours.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nothing pending verification.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPeerDetailPage;
