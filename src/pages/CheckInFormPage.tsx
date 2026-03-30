import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { updateCrpsCompetencies } from "@/lib/crps-updater";

type SituationTag = Database["public"]["Enums"]["mi_situation_tag"];

const MOOD_OPTIONS = [
  { value: 1, label: "Crisis", color: "bg-red-500 hover:bg-red-600 text-white" },
  { value: 2, label: "Struggling", color: "bg-orange-400 hover:bg-orange-500 text-white" },
  { value: 3, label: "Getting By", color: "bg-amber-400 hover:bg-amber-500 text-white" },
  { value: 4, label: "Good", color: "bg-teal-500 hover:bg-teal-600 text-white" },
  { value: 5, label: "Thriving", color: "bg-green-500 hover:bg-green-600 text-white" },
];

const SITUATION_OPTIONS: { value: SituationTag; label: string }[] = [
  { value: "first_checkin", label: "First Check-In" },
  { value: "ambivalence", label: "Ambivalence" },
  { value: "barriers", label: "Barriers" },
  { value: "motivation", label: "Motivation" },
  { value: "planning", label: "Planning" },
  { value: "crisis", label: "Crisis" },
  { value: "general", label: "General" },
];

const CheckInFormPage = () => {
  const { participantId } = useParams<{ participantId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Date>(new Date());
  const [mood, setMood] = useState<number | null>(null);
  const [situation, setSituation] = useState<SituationTag | null>(null);
  const [summary, setSummary] = useState("");
  const [planProgress, setPlanProgress] = useState("");
  const [barriers, setBarriers] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [promptFeedbackGiven, setPromptFeedbackGiven] = useState(false);
  const [showCrisisOverlay, setShowCrisisOverlay] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["participant-checkin-profile", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("first_name, user_id")
        .eq("id", participantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: miPrompt, refetch: refetchPrompt } = useQuery({
    queryKey: ["mi-prompt", situation],
    enabled: !!situation,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_prompts")
        .select("*")
        .eq("situation_tag", situation!)
        .eq("is_active", true);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[Math.floor(Math.random() * data.length)];
    },
  });

  const { data: crisisProtocol } = useQuery({
    queryKey: ["crisis-protocol"],
    enabled: showCrisisOverlay,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crisis_protocol")
        .select("content")
        .eq("is_current", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleSituationChange = (val: string) => {
    setSituation(val as SituationTag);
    setPromptFeedbackGiven(false);
  };

  const handlePromptFeedback = async (type: "helpful" | "not_relevant") => {
    if (!miPrompt || promptFeedbackGiven) return;
    setPromptFeedbackGiven(true);

    const { data: current } = await supabase
      .from("mi_prompts")
      .select("usage_count, helpful_count, not_relevant_count")
      .eq("id", miPrompt.id)
      .single();

    if (!current) return;

    const updates: Record<string, number> = {
      usage_count: (current.usage_count ?? 0) + 1,
    };
    if (type === "helpful") {
      updates.helpful_count = (current.helpful_count ?? 0) + 1;
    } else {
      updates.not_relevant_count = (current.not_relevant_count ?? 0) + 1;
    }

    await supabase.from("mi_prompts").update(updates).eq("id", miPrompt.id);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !participantId || mood === null) throw new Error("Missing required fields");

      // 1. Insert check-in
      const { data: checkin, error } = await supabase
        .from("weekly_checkins")
        .insert({
          participant_id: participantId,
          peer_specialist_id: user.id,
          checkin_date: format(date, "yyyy-MM-dd"),
          mood_status: mood,
          summary: summary || null,
          plan_progress_notes: planProgress || null,
          barriers: barriers || null,
          next_steps: nextSteps || null,
          mi_techniques_used: situation ? [situation] : [],
        })
        .select("id")
        .single();
      if (error) throw error;

      // 2. Log CRPS hours
      await supabase.rpc("log_checkin_crps_hours", {
        p_checkin_id: checkin.id,
        p_peer_id: user.id,
      });

      // 3. Notification for participant
      if (profile?.user_id) {
        await supabase.from("notifications").insert({
          user_id: profile.user_id,
          type: "general",
          title: "Check-In Logged",
          body: "Your peer specialist logged a check-in for today.",
          link: "/plan",
        });
      }

      return { isCrisis: situation === "crisis" };
    },
    onSuccess: ({ isCrisis }) => {
      queryClient.invalidateQueries({ queryKey: ["weekly-checkins"] });
      toast({ title: "Check-in saved", description: "CRPS hours logged automatically." });

      if (isCrisis) {
        setShowCrisisOverlay(true);
      } else {
        navigate(`/caseload/${participantId}?tab=checkins`);
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const firstName = profile?.first_name || "Participant";

  return (
    <div className="px-4 pt-4 pb-8 max-w-lg mx-auto space-y-6">
      {/* Crisis Protocol Overlay */}
      {showCrisisOverlay && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-destructive">
              🚨 Crisis Protocol — Quick Reference
            </h2>
            {crisisProtocol?.content ? (
              <div className="text-sm text-foreground whitespace-pre-wrap">
                {crisisProtocol.content}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Loading crisis protocol…</p>
            )}
            <Button
              className="w-full"
              onClick={() => navigate(`/caseload/${participantId}?tab=checkins`)}
            >
              Got it, continue
            </Button>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link
        to={`/caseload/${participantId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="text-xl font-bold text-foreground">
        Weekly Check-In — {firstName}
      </h1>

      {/* FIELD 1: Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* FIELD 2: Mood */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          How is {firstName} doing today?
        </label>
        <div className="grid grid-cols-5 gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={cn(
                "rounded-xl py-3 text-xs font-semibold transition-all",
                mood === m.value
                  ? `${m.color} ring-2 ring-offset-2 ring-foreground/30 scale-105`
                  : `${m.color} opacity-70`
              )}
            >
              {m.value}
              <br />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* FIELD 3: Situation + MI Prompt */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          What's the primary theme of today's conversation?
        </label>
        <Select onValueChange={handleSituationChange} value={situation ?? undefined}>
          <SelectTrigger>
            <SelectValue placeholder="Select a situation…" />
          </SelectTrigger>
          <SelectContent>
            {SITUATION_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {miPrompt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">
              💡 MI Tip: {miPrompt.text}
            </p>
            {miPrompt.explanation && (
              <p className="text-xs text-amber-700/70 italic">{miPrompt.explanation}</p>
            )}
            {!promptFeedbackGiven ? (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handlePromptFeedback("helpful")}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" /> This helped
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handlePromptFeedback("not_relevant")}
                >
                  <X className="h-3 w-3 mr-1" /> Not relevant
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-700/60">Thanks for the feedback!</p>
            )}
          </div>
        )}
      </div>

      {/* FIELD 4-7: Textareas */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Conversation Summary</label>
        <Textarea
          placeholder="What did you discuss today?"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Plan Progress</label>
        <Textarea
          placeholder="Which action steps were reviewed? Any progress this week?"
          value={planProgress}
          onChange={(e) => setPlanProgress(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Barriers Identified</label>
        <Textarea
          placeholder="What's getting in the way?"
          value={barriers}
          onChange={(e) => setBarriers(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Next Steps Agreed</label>
        <Textarea
          placeholder="What was agreed on before the next check-in?"
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
        />
      </div>

      {/* Submit */}
      <Button
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
        disabled={mood === null || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? "Saving…" : "Save Check-In"}
      </Button>
    </div>
  );
};

export default CheckInFormPage;
