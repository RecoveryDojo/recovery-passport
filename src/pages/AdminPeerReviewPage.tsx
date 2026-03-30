import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, ClipboardCheck, Award, FileText, MessageSquare, Send } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type HourCategory = Database["public"]["Enums"]["crps_hour_category"];

const SUPERVISED_CATEGORIES: { value: HourCategory; label: string }[] = [
  { value: "supervised_recovery_support", label: "Recovery Support" },
  { value: "supervised_advocacy", label: "Advocacy" },
  { value: "supervised_mentoring", label: "Mentoring" },
  { value: "supervised_professional_responsibility", label: "Professional Responsibility" },
];

type InteractionType = "checkin" | "milestone" | "progress_note";

interface Interaction {
  id: string;
  type: InteractionType;
  peer_id: string;
  peer_name: string;
  participant_name: string;
  participant_id: string;
  date: string;
  snippet: string;
  is_crisis: boolean;
  source_type_for_hours: Database["public"]["Enums"]["crps_source_type"];
}

const AdminPeerReviewPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [peerFilter, setPeerFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Interaction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [hourDomain, setHourDomain] = useState<HourCategory>("supervised_recovery_support");

  // Load all interactions
  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["admin-peer-interactions"],
    queryFn: async () => {
      const items: Interaction[] = [];

      // Checkins
      const { data: checkins } = await supabase
        .from("weekly_checkins")
        .select("id, peer_specialist_id, participant_id, checkin_date, summary, mood_status")
        .order("checkin_date", { ascending: false })
        .limit(100);

      // Milestones
      const { data: milestones } = await supabase
        .from("participant_milestones")
        .select("id, unlocked_by, participant_id, unlocked_at, note, milestone_id")
        .order("unlocked_at", { ascending: false })
        .limit(50);

      // Progress notes
      const { data: notes } = await supabase
        .from("progress_notes")
        .select("id, author_id, participant_id, created_at, content, note_type")
        .order("created_at", { ascending: false })
        .limit(50);

      // Gather unique IDs for names
      const peerIds = new Set<string>();
      const participantIds = new Set<string>();
      const milestoneDefIds = new Set<string>();

      (checkins ?? []).forEach((c) => { peerIds.add(c.peer_specialist_id); participantIds.add(c.participant_id); });
      (milestones ?? []).forEach((m) => { peerIds.add(m.unlocked_by); participantIds.add(m.participant_id); milestoneDefIds.add(m.milestone_id); });
      (notes ?? []).forEach((n) => { peerIds.add(n.author_id); participantIds.add(n.participant_id); });

      const [{ data: peers }, { data: participants }, { data: milestoneDefs }] = await Promise.all([
        supabase.from("peer_specialist_profiles").select("user_id, first_name, last_name").in("user_id", [...peerIds]),
        supabase.from("participant_profiles").select("id, first_name, last_name").in("id", [...participantIds]),
        milestoneDefIds.size > 0
          ? supabase.from("milestone_definitions").select("id, name").in("id", [...milestoneDefIds])
          : Promise.resolve({ data: [] }),
      ]);

      const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`.trim() || "Peer"]));
      const partMap = Object.fromEntries((participants ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim() || "Participant"]));
      const mDefMap = Object.fromEntries((milestoneDefs ?? []).map((d) => [d.id, d.name]));

      (checkins ?? []).forEach((c) => {
        items.push({
          id: c.id, type: "checkin", peer_id: c.peer_specialist_id,
          peer_name: peerMap[c.peer_specialist_id] ?? "Peer",
          participant_name: partMap[c.participant_id] ?? "Participant",
          participant_id: c.participant_id,
          date: c.checkin_date,
          snippet: c.summary?.slice(0, 120) || `Mood: ${c.mood_status}/5`,
          is_crisis: c.mood_status <= 2,
          source_type_for_hours: "checkin",
        });
      });

      (milestones ?? []).forEach((m) => {
        items.push({
          id: m.id, type: "milestone", peer_id: m.unlocked_by,
          peer_name: peerMap[m.unlocked_by] ?? "Peer",
          participant_name: partMap[m.participant_id] ?? "Participant",
          participant_id: m.participant_id,
          date: m.unlocked_at,
          snippet: `${mDefMap[m.milestone_id] ?? "Milestone"}: ${m.note ?? "No note"}`,
          is_crisis: false,
          source_type_for_hours: "milestone",
        });
      });

      (notes ?? []).forEach((n) => {
        items.push({
          id: n.id, type: "progress_note", peer_id: n.author_id,
          peer_name: peerMap[n.author_id] ?? "Peer",
          participant_name: partMap[n.participant_id] ?? "Participant",
          participant_id: n.participant_id,
          date: n.created_at,
          snippet: n.content?.slice(0, 120) || "",
          is_crisis: n.note_type === "crisis",
          source_type_for_hours: "checkin",
        });
      });

      // Sort: crisis first, then by date desc
      items.sort((a, b) => {
        if (a.is_crisis && !b.is_crisis) return -1;
        if (!a.is_crisis && b.is_crisis) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      return items;
    },
  });

  const uniquePeers = [...new Map(interactions.map((i) => [i.peer_id, i.peer_name])).entries()];

  const filtered = interactions.filter((i) => {
    if (filter === "crisis" && !i.is_crisis) return false;
    if (peerFilter !== "all" && i.peer_id !== peerFilter) return false;
    return true;
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user || !feedback.trim()) throw new Error("Missing data");

      const targetType = selected.type === "checkin" ? "checkin" 
        : selected.type === "milestone" ? "milestone" 
        : "progress_note";

      // 1. Insert feedback
      await supabase.from("supervisor_feedback").insert({
        target_type: targetType as any,
        target_id: selected.id,
        supervisor_id: user.id,
        feedback: feedback.trim(),
      });

      // 2. Credit supervised hours
      await supabase.from("crps_hours_log").insert({
        peer_specialist_id: selected.peer_id,
        category: hourDomain,
        hours: 0.5,
        source_type: selected.source_type_for_hours,
        source_id: selected.id,
        verified_by: user.id,
      });

      // 3. Notify peer
      const typeLabel = selected.type === "checkin" ? "check-in" : selected.type === "milestone" ? "milestone" : "progress note";
      await supabase.from("notifications").insert({
        user_id: selected.peer_id,
        type: "supervisor_feedback" as const,
        title: "New Supervisor Feedback",
        body: `New supervisor feedback on your ${typeLabel} for ${selected.participant_name}. Tap to read.`,
        link: "/crps",
        related_id: selected.id,
        related_type: targetType,
      });
    },
    onSuccess: () => {
      toast.success("Feedback sent & hours credited");
      setSelected(null);
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: ["admin-peer-interactions"] });
    },
    onError: () => toast.error("Failed to submit feedback"),
  });

  const typeIcon = (type: InteractionType, isCrisis: boolean) => {
    if (isCrisis) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (type === "checkin") return <ClipboardCheck className="h-4 w-4 text-primary" />;
    if (type === "milestone") return <Award className="h-4 w-4 text-accent" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const typeLabel = (type: InteractionType) => {
    if (type === "checkin") return "Check-In";
    if (type === "milestone") return "Milestone";
    return "Progress Note";
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Peer Specialist Review</h1>
        <p className="text-sm text-muted-foreground">Review interactions and provide supervised feedback</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="crisis">Crisis Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={peerFilter} onValueChange={setPeerFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Peers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Peers</SelectItem>
            {uniquePeers.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Feed */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm animate-pulse">Loading interactions…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No interactions found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card
              key={`${item.type}-${item.id}`}
              className={`cursor-pointer hover:border-accent/50 transition-colors ${item.is_crisis ? "border-red-200 bg-red-50/30" : ""}`}
              onClick={() => { setSelected(item); setFeedback(""); }}
            >
              <CardContent className="p-3 flex items-start gap-3">
                <div className="mt-0.5">{typeIcon(item.type, item.is_crisis)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{item.peer_name}</span>
                    <Badge variant="outline" className="text-[10px]">{typeLabel(item.type)}</Badge>
                    {item.is_crisis && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Crisis</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For {item.participant_name} · {format(new Date(item.date), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-foreground mt-1 line-clamp-2">{item.snippet}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Feedback Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              <div className="flex items-center gap-2">
                {selected && typeIcon(selected.type, selected.is_crisis)}
                {selected && typeLabel(selected.type)}
              </div>
            </SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Peer:</span> {selected.peer_name}</p>
                <p><span className="text-muted-foreground">Participant:</span> {selected.participant_name}</p>
                <p><span className="text-muted-foreground">Date:</span> {format(new Date(selected.date), "MMM d, yyyy h:mm a")}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-sm text-foreground">{selected.snippet}</div>

              <div className="border-t border-border pt-4 space-y-3">
                <Label className="text-sm font-semibold">Write feedback for {selected.peer_name}</Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={`Write feedback for ${selected.peer_name}...`}
                  rows={4}
                />
                <div>
                  <Label className="text-sm">Credit supervised hours to:</Label>
                  <Select value={hourDomain} onValueChange={(v) => setHourDomain(v as HourCategory)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPERVISED_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => submitFeedbackMutation.mutate()}
                  disabled={!feedback.trim() || submitFeedbackMutation.isPending}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitFeedbackMutation.isPending ? "Sending…" : "Send Feedback + Credit Hours"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminPeerReviewPage;
