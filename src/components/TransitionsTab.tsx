import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2, FileText, Send } from "lucide-react";
import { updateCrpsCompetencies } from "@/lib/crps-updater";

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700" },
  requested: { label: "Requested", color: "bg-blue-100 text-blue-700" },
  peer_approved: { label: "Peer Approved", color: "bg-green-100 text-green-700" },
  completed: { label: "Completed", color: "bg-primary/10 text-primary" },
};

interface TransitionsTabProps {
  participantId: string;
  participantName: string;
  participantUserId: string;
  viewerRole: "peer" | "admin";
}

const TransitionsTab = ({ participantId, participantName, participantUserId, viewerRole }: TransitionsTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [peerNote, setPeerNote] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ["referrals", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*, community_partners:partner_id(name, type, address, city, phone)")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Transition notifications (from participants requesting placements)
  const { data: transitionNotifs = [] } = useQuery({
    queryKey: ["transition-notifs", participantId],
    enabled: !!participantId && viewerRole === "peer",
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("related_type", "community_partners")
        .ilike("title", `%${participantName.split(" ")[0]}%`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Community partners for creating referrals
  const { data: partners = [] } = useQuery({
    queryKey: ["approved-partners"],
    enabled: createDialogOpen,
    queryFn: async () => {
      const { data } = await supabase.from("community_partners").select("id, name, type, address, city").eq("is_approved", true).order("name");
      return data ?? [];
    },
  });

  // Peer profile for notifications
  const { data: peerProfile } = useQuery({
    queryKey: ["my-peer-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("peer_specialist_profiles").select("first_name, last_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  // Discharge summary data
  const { data: summaryData } = useQuery({
    queryKey: ["discharge-summary", participantId],
    enabled: summaryOpen,
    queryFn: async () => {
      const [milestones, assessments, checkins, plan] = await Promise.all([
        supabase.from("participant_milestones").select("id, milestone_id, milestone_definitions:milestone_id(name)").eq("participant_id", participantId),
        supabase.from("assessment_sessions").select("overall_score, completed_at").eq("participant_id", participantId).not("confirmed_by", "is", null).order("completed_at", { ascending: false }),
        supabase.from("weekly_checkins").select("id, mood_status").eq("participant_id", participantId).order("checkin_date", { ascending: false }),
        supabase.from("recovery_plans").select("id").eq("participant_id", participantId).eq("is_current", true).maybeSingle(),
      ]);

      let phaseProgress: { phase: string; total: number; completed: number }[] = [];
      if (plan.data) {
        const { data: phases } = await supabase.from("plan_phases").select("id, phase, title").eq("plan_id", plan.data.id);
        if (phases?.length) {
          const { data: steps } = await supabase.from("plan_action_steps").select("phase_id, is_completed").in("phase_id", phases.map((p) => p.id));
          phaseProgress = phases.map((p) => ({
            phase: p.title,
            total: steps?.filter((s) => s.phase_id === p.id).length ?? 0,
            completed: steps?.filter((s) => s.phase_id === p.id && s.is_completed).length ?? 0,
          }));
        }
      }

      return {
        milestones: milestones.data?.map((m) => (m.milestone_definitions as any)?.name).filter(Boolean) ?? [],
        rcScores: assessments.data?.map((a) => ({ score: a.overall_score, date: a.completed_at })) ?? [],
        totalCheckins: checkins.data?.length ?? 0,
        latestMood: checkins.data?.[0]?.mood_status ?? null,
        phaseProgress,
      };
    },
  });

  const createReferralMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartner || !user) throw new Error("Missing data");
      const { data, error } = await supabase
        .from("referrals")
        .insert({
          participant_id: participantId,
          partner_id: selectedPartner.id,
          referred_by: user.id,
          status: "requested",
          notes: peerNote.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Notify participant
      const peerName = peerProfile ? `${peerProfile.first_name} ${peerProfile.last_name}`.trim() : "Your peer specialist";
      await supabase.from("notifications").insert({
        user_id: participantUserId,
        type: "referral_received" as any,
        title: "Transition initiated",
        body: `${peerName} has initiated your transition to ${selectedPartner.name}. You will be contacted soon.`,
        link: "/plan",
      });

      updateCrpsCompetencies({ action: "referral", peer_id: user.id, participant_id: participantId });
      return data;
    },
    onSuccess: () => {
      toast.success("Referral created");
      queryClient.invalidateQueries({ queryKey: ["referrals", participantId] });
      setCreateDialogOpen(false);
      setSelectedPartner(null);
      setPeerNote("");
    },
    onError: () => toast.error("Failed to create referral"),
  });

  const signOffMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const referral = referrals.find((r) => r.id === referralId);
      const { error } = await supabase
        .from("referrals")
        .update({ status: "peer_approved", updated_at: new Date().toISOString() })
        .eq("id", referralId);
      if (error) throw error;

      const peerName = peerProfile ? `${peerProfile.first_name} ${peerProfile.last_name}`.trim() : "Your peer specialist";
      const partnerName = (referral?.community_partners as any)?.name ?? "the placement";
      await supabase.from("notifications").insert({
        user_id: participantUserId,
        type: "general" as any,
        title: "Transition approved",
        body: `${peerName} has signed off on your transition to ${partnerName}. You're cleared to move forward.`,
      });
    },
    onSuccess: () => {
      toast.success("Signed off");
      queryClient.invalidateQueries({ queryKey: ["referrals", participantId] });
    },
    onError: () => toast.error("Failed to sign off"),
  });

  const completeMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const { error } = await supabase
        .from("referrals")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", referralId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as completed");
      queryClient.invalidateQueries({ queryKey: ["referrals", participantId] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const moodLabels: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        {(viewerRole === "peer" || viewerRole === "admin") && (
          <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setCreateDialogOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> Start Referral
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={() => setSummaryOpen(true)}>
          <FileText className="h-4 w-4 mr-1" /> Discharge Summary
        </Button>
      </div>

      {/* Transition notifications (peer only) */}
      {viewerRole === "peer" && transitionNotifs.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Transition Requests</h3>
          {transitionNotifs.map((n) => (
            <Card key={n.id} className="border-amber-200 bg-amber-50/30">
              <CardContent className="p-3">
                <p className="text-sm text-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, yyyy")}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Referrals list */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Referrals ({referrals.length})</h3>
        {referrals.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No referrals yet.</CardContent></Card>
        ) : (
          referrals.map((ref) => {
            const partner = ref.community_partners as any;
            const style = STATUS_STYLES[ref.status] ?? STATUS_STYLES.pending;
            return (
              <Card key={ref.id} className="border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground text-sm">{partner?.name ?? "Unknown"}</p>
                    <Badge className={`${style.color} border-0 text-xs`}>{style.label}</Badge>
                  </div>
                  {ref.notes && <p className="text-xs text-muted-foreground">{ref.notes}</p>}
                  <p className="text-[10px] text-muted-foreground">{format(new Date(ref.created_at), "MMM d, yyyy")}</p>

                  <div className="flex gap-2">
                    {viewerRole === "peer" && ref.status === "requested" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => signOffMutation.mutate(ref.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Sign Off
                      </Button>
                    )}
                    {viewerRole === "admin" && ref.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => completeMutation.mutate(ref.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Completed
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {/* Create referral dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Start Referral</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a placement for {participantName}:</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {partners.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPartner(p)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    selectedPartner?.id === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{[p.address, p.city].filter(Boolean).join(", ")}</p>
                </button>
              ))}
            </div>
            <Textarea placeholder="Add a note (optional)" value={peerNote} onChange={(e) => setPeerNote(e.target.value)} rows={2} />
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!selectedPartner || createReferralMutation.isPending}
              onClick={() => createReferralMutation.mutate()}
            >
              {createReferralMutation.isPending ? "Creating…" : "Create Referral"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discharge summary dialog */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Discharge Summary</DialogTitle></DialogHeader>
          {summaryData ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Milestones Earned ({summaryData.milestones.length})</p>
                <p className="text-muted-foreground">{summaryData.milestones.join(", ") || "None yet"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">RC Score Trend</p>
                {summaryData.rcScores.length > 0 ? (
                  <p className="text-muted-foreground">
                    {summaryData.rcScores.map((s) => `${s.score} (${format(new Date(s.date), "MMM d")})`).join(" → ")}
                  </p>
                ) : <p className="text-muted-foreground">No assessments</p>}
              </div>
              <div>
                <p className="font-medium text-foreground">Plan Progress</p>
                {summaryData.phaseProgress.map((p) => (
                  <p key={p.phase} className="text-muted-foreground">
                    {p.phase}: {p.total > 0 ? `${Math.round((p.completed / p.total) * 100)}%` : "No steps"}
                  </p>
                ))}
              </div>
              <div>
                <p className="font-medium text-foreground">Check-Ins: {summaryData.totalCheckins}</p>
                {summaryData.latestMood && (
                  <p className="text-muted-foreground">Most recent mood: {moodLabels[summaryData.latestMood] ?? summaryData.latestMood}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Loading summary…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransitionsTab;
