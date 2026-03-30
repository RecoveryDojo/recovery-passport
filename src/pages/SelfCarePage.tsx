import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";
import { updateCrpsCompetencies } from "@/lib/crps-updater";

const MOOD_OPTIONS = [
  { value: 1, emoji: "😔", label: "Low" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
  { value: 5, emoji: "😄", label: "Amazing" },
];

const ENERGY_OPTIONS = [
  { value: 1, label: "Depleted" },
  { value: 2, label: "Low" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "Good" },
  { value: 5, label: "High" },
];

const STRESS_OPTIONS = [
  { value: 1, label: "Low" },
  { value: 2, label: "Mild" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "High" },
  { value: 5, label: "Overwhelming" },
];

const SelfCarePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showFlagged, setShowFlagged] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!mood || !energy || !stress || !user) throw new Error("Missing fields");

      const isFlagged = stress >= 4 || mood <= 2;

      const { data, error } = await supabase
        .from("self_care_checks")
        .insert({
          peer_specialist_id: user.id,
          mood,
          energy,
          stress,
          notes: notes.trim() || null,
          is_flagged: isFlagged,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Log 0.25 hours to work_experience
      await supabase.from("crps_hours_log").insert({
        peer_specialist_id: user.id,
        category: "work_experience" as any,
        hours: 0.25,
        source_type: "manual" as any,
        source_id: data.id,
      });

      // Update Self-Care & Vicarious Trauma skill
      updateCrpsCompetencies({ action: "self_care", peer_id: user.id });

      return isFlagged;
    },
    onSuccess: (isFlagged) => {
      if (isFlagged) {
        setShowFlagged(true);
      } else {
        toast.success("Self-care check completed");
        navigate("/caseload");
      }
    },
    onError: () => toast.error("Failed to save self-care check"),
  });

  if (showFlagged) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 space-y-4 text-center">
            <Heart className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="text-lg font-semibold text-green-800">Thank you for checking in</h2>
            <p className="text-sm text-green-700">
              It takes strength to check in with yourself. Consider reaching out to your supervisor
              or a trusted colleague today. You can't pour from an empty cup.
            </p>
            <Button onClick={() => navigate("/caseload")} className="bg-primary hover:bg-primary/90">
              Back to Caseload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isValid = mood !== null && energy !== null && stress !== null;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/caseload")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Caseload
      </Button>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground">A moment for you.</h1>
        <p className="text-sm text-muted-foreground">
          This is private. Your supervisor can only see that you completed it — never what you shared.
        </p>
      </div>

      {/* Mood */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-foreground">How's your mood today?</label>
        <div className="flex gap-2 justify-center">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMood(opt.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${
                mood === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-[10px] text-muted-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Energy */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-foreground">How's your energy level?</label>
        <div className="flex gap-2 justify-center flex-wrap">
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEnergy(opt.value)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                energy === opt.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-card text-foreground hover:border-primary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Stress */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-foreground">How's your stress level this week?</label>
        <div className="flex gap-2 justify-center flex-wrap">
          {STRESS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStress(opt.value)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                stress === opt.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-card text-foreground hover:border-primary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-foreground">Anything on your mind?</label>
        <Textarea
          placeholder="Optional — this stays private..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </section>

      <Button
        className="w-full bg-primary hover:bg-primary/90"
        disabled={!isValid || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? "Saving…" : "Submit Check-In"}
      </Button>
    </div>
  );
};

export default SelfCarePage;
