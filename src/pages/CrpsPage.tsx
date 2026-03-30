import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronDown, Plus, CheckCircle2, Clock, Play, Award, PartyPopper } from "lucide-react";
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

const TOTAL_REQUIRED = HOUR_REQUIREMENTS.reduce((s, r) => s + r.required, 0);

const CATEGORY_OPTIONS: { value: HourCategory; label: string }[] = [
  { value: "training", label: "Training" },
  { value: "work_experience", label: "Work Experience" },
  { value: "direct_peer_services", label: "Direct Peer Services" },
  { value: "supervised_advocacy", label: "Supervised: Advocacy" },
  { value: "supervised_mentoring", label: "Supervised: Mentoring" },
  { value: "supervised_recovery_support", label: "Supervised: Recovery Support" },
  { value: "supervised_professional_responsibility", label: "Supervised: Professional Responsibility" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <Play className="h-4 w-4" /> },
  demonstrated: { label: "Demonstrated", color: "bg-blue-100 text-blue-700", icon: <Award className="h-4 w-4" /> },
  verified: { label: "Verified", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-4 w-4" /> },
};

const CrpsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formCat, setFormCat] = useState<HourCategory>("training");
  const [formHours, setFormHours] = useState("");
  const [formDesc, setFormDesc] = useState("");

  // Hours totals
  const { data: hourTotals = {} } = useQuery({
    queryKey: ["crps-hours", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("crps_hours_log")
        .select("category, hours")
        .eq("peer_specialist_id", user!.id);
      const totals: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        totals[r.category] = (totals[r.category] || 0) + Number(r.hours);
      });
      return totals;
    },
  });

  // Competency milestones
  const { data: competencies = [] } = useQuery({
    queryKey: ["crps-competencies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("crps_competency_milestones")
        .select("tool_or_skill, type, status")
        .eq("peer_specialist_id", user!.id);
      return data ?? [];
    },
  });

  // Hours log
  const { data: hoursLog = [] } = useQuery({
    queryKey: ["crps-hours-log", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("crps_hours_log")
        .select("id, category, hours, source_type, logged_at, verified_by")
        .eq("peer_specialist_id", user!.id)
        .order("logged_at", { ascending: false });
      if (!data || data.length === 0) return [];
      const verifierIds = [...new Set(data.filter((r) => r.verified_by).map((r) => r.verified_by!))];
      let verifierMap: Record<string, string> = {};
      if (verifierIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, email").in("id", verifierIds);
        verifierMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.email]));
      }
      return data.map((r) => ({ ...r, verifierName: r.verified_by ? verifierMap[r.verified_by] ?? "Supervisor" : null }));
    },
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      const hrs = parseFloat(formHours);
      if (!hrs || hrs <= 0 || !formDesc.trim()) throw new Error("Invalid");
      const { error } = await supabase.from("crps_hours_log").insert({
        peer_specialist_id: user!.id,
        category: formCat,
        hours: hrs,
        source_type: "manual" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hours logged");
      setDialogOpen(false);
      setFormHours("");
      setFormDesc("");
      queryClient.invalidateQueries({ queryKey: ["crps-hours"] });
      queryClient.invalidateQueries({ queryKey: ["crps-hours-log"] });
    },
    onError: () => toast.error("Failed to log hours"),
  });

  // Calculations
  const totalLogged = HOUR_REQUIREMENTS.reduce((s, r) => s + Math.min(hourTotals[r.category] || 0, r.required), 0);
  const overallPct = Math.min(Math.round((totalLogged / TOTAL_REQUIRED) * 100), 100);
  const allMet = HOUR_REQUIREMENTS.every((r) => (hourTotals[r.category] || 0) >= r.required);

  const tools = competencies.filter((c) => c.type === "tool");
  const skills = competencies.filter((c) => c.type === "skill");

  const catLabel = (cat: string) => CATEGORY_OPTIONS.find((c) => c.value === cat)?.label ?? cat;

  return (
    <div className="px-4 pt-4 pb-20 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">My CRPS Certification Progress</h1>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={overallPct} className="flex-1 h-3" />
          <span className="text-sm font-semibold text-primary whitespace-nowrap">{overallPct}%</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{overallPct}% toward eligibility</p>
      </div>

      {/* Exam Ready Banner */}
      {allMet && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-3">
          <PartyPopper className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">
              You've met all CRPS hour requirements!
            </p>
            <p className="text-xs text-green-700 mt-1">
              You're eligible to apply for certification through the Florida Certification Board.
            </p>
          </div>
        </div>
      )}

      {/* Hours Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Hours Progress</h2>
        {HOUR_REQUIREMENTS.map((req) => {
          const current = hourTotals[req.category] || 0;
          const pct = Math.min(Math.round((current / req.required) * 100), 100);
          const complete = current >= req.required;
          return (
            <div key={req.category} className={req.sub ? "pl-4" : ""}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground font-medium">
                  {req.sub && "↳ "}{req.label}
                </span>
                <span className={`font-mono text-xs ${complete ? "text-green-600" : "text-muted-foreground"}`}>
                  {current.toFixed(1)} / {req.required}
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${complete ? "bg-green-500" : "bg-accent"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Supervised section label */}
        <p className="text-xs text-muted-foreground -mt-1 pl-4">Supervised Hours (sub-categories above)</p>
      </section>

      {/* Tools Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">6 Tools</h2>
        <div className="grid gap-2">
          {tools.map((t) => {
            const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.not_started;
            return (
              <Card key={t.tool_or_skill} className="border-border">
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{t.tool_or_skill}</span>
                  <Badge className={`${cfg.color} border-0 gap-1`}>
                    {cfg.icon} {cfg.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Skills Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">6 Skills</h2>
        <div className="grid gap-2">
          {skills.map((s) => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.not_started;
            return (
              <Card key={s.tool_or_skill} className="border-border">
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.tool_or_skill}</span>
                  <Badge className={`${cfg.color} border-0 gap-1`}>
                    {cfg.icon} {cfg.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Manual Entry */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Log Manual Hours
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Manual Hours</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Category</Label>
              <Select value={formCat} onValueChange={(v) => setFormCat(v as HourCategory)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hours</Label>
              <Input type="number" step="0.5" min="0.5" value={formHours}
                onChange={(e) => setFormHours(e.target.value)} placeholder="e.g. 2.5" className="mt-1" />
            </div>
            <div>
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                placeholder="e.g. Attended training workshop on trauma-informed care" className="mt-1" />
            </div>
            <Button onClick={() => logMutation.mutate()}
              disabled={!formHours || !formDesc.trim() || logMutation.isPending}
              className="w-full">
              {logMutation.isPending ? "Saving…" : "Log Hours"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hours Log */}
      <Collapsible open={logOpen} onOpenChange={setLogOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            View Hours Log
            <ChevronDown className={`h-4 w-4 transition-transform ${logOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2">
          {hoursLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hours logged yet</p>
          ) : (
            hoursLog.map((entry) => (
              <Card key={entry.id} className="border-border">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{catLabel(entry.category)}</span>
                    <span className="text-sm font-mono text-accent">{Number(entry.hours).toFixed(1)} hrs</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(entry.logged_at), "MMM d, yyyy")}</span>
                    <span className="capitalize">{entry.source_type.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.verifierName
                      ? `✓ Verified by ${entry.verifierName}`
                      : "Pending supervisor verification"}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default CrpsPage;
