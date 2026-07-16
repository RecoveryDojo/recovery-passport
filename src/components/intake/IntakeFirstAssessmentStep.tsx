import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  participantId: string;
  onCompleted: () => void;
}

export function IntakeFirstAssessmentStep({ sessionId, participantId, onCompleted }: Props) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Check for an existing completed assessment linked to this intake session
  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ["intake-first-assessment", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_sessions")
        .select("id")
        .eq("intake_session_id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: domains } = useQuery({
    queryKey: ["assessment-domains-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_domains")
        .select("id, name, description")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: allLevels } = useQuery({
    queryKey: ["assessment-domain-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_domain_levels")
        .select("domain_id, score, label, description")
        .order("score");
      if (error) throw error;
      return data;
    },
  });

  if (existingLoading || !domains || !allLevels) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (existing) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-primary">First Assessment</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Already completed for this intake.
          </p>
        </div>
        <Button onClick={onCompleted} className="w-full min-h-[52px]">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  const totalDomains = domains.length;
  const currentDomain = domains[currentIndex];
  const domainLevels = allLevels.filter((l) => l.domain_id === currentDomain?.id);
  const selectedScore = currentDomain ? scores[currentDomain.id] : undefined;

  const overallScore =
    totalDomains > 0
      ? (Object.values(scores).reduce((a, b) => a + b, 0) / totalDomains).toFixed(1)
      : "0";

  const handleSelect = (domainId: string, score: number) => {
    setScores((prev) => ({ ...prev, [domainId]: score }));
  };

  const handleNext = () => {
    if (currentIndex < totalDomains - 1) setCurrentIndex((i) => i + 1);
    else setShowResults(true);
  };

  const handleBack = () => {
    if (showResults) setShowResults(false);
    else if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { count: existingCount } = await supabase
        .from("assessment_sessions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participantId);

      const isFirst = (existingCount ?? 0) === 0;

      const { data: session, error: sessErr } = await supabase
        .from("assessment_sessions")
        .insert({
          participant_id: participantId,
          initiated_by: user!.id,
          overall_score: parseFloat(overallScore),
          intake_session_id: sessionId,
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      const scoreRows = domains.map((d) => ({
        session_id: session.id,
        domain_id: d.id,
        score: scores[d.id],
      }));
      const { error: scoresErr } = await supabase
        .from("assessment_scores")
        .insert(scoreRows);
      if (scoresErr) throw scoresErr;

      if (isFirst) {
        await supabase.rpc("generate_recovery_plan", {
          p_participant_id: participantId,
        });
      }

      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: "submit_assessment",
        target_type: "assessment_sessions",
        target_id: session.id,
        metadata: {
          overall_score: parseFloat(overallScore),
          participant_id: participantId,
          intake_session_id: sessionId,
        },
      });

      toast.success("Assessment recorded");
      onCompleted();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assessment");
    } finally {
      setSubmitting(false);
    }
  };

  if (showResults) {
    return (
      <div className="space-y-6">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-xl font-semibold text-primary">Review Assessment</h2>
        <div className="text-center py-2">
          <p className="text-5xl font-extrabold text-accent">{overallScore}</p>
          <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
        </div>
        <div className="space-y-3">
          {domains.map((d) => {
            const s = scores[d.id];
            const level = allLevels.find((l) => l.domain_id === d.id && l.score === s);
            const color = s <= 2 ? "bg-red-400" : s === 3 ? "bg-accent" : "bg-green-500";
            return (
              <div key={d.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{d.name}</span>
                  <span className="font-bold text-foreground">{s}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${(s / 5) * 100}%` }} />
                </div>
                {level && (
                  <p className="text-xs text-muted-foreground">{level.label}: {level.description}</p>
                )}
              </div>
            );
          })}
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full min-h-[52px] bg-accent hover:bg-accent/90 text-accent-foreground">
          {submitting ? "Saving…" : "Submit Assessment"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">First Assessment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recovery Capital Assessment — Domain {currentIndex + 1} of {totalDomains}
        </p>
        <Progress value={((currentIndex + 1) / totalDomains) * 100} className="h-2 mt-3" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground">{currentDomain.name}</h3>
        {currentDomain.description && (
          <p className="text-sm text-muted-foreground mt-1">{currentDomain.description}</p>
        )}
      </div>

      <div className="space-y-3">
        {domainLevels.map((level) => {
          const isSelected = selectedScore === level.score;
          return (
            <button
              key={level.score}
              onClick={() => handleSelect(currentDomain.id, level.score)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isSelected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {level.score}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">{level.label}</p>
                  {level.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{level.description}</p>
                  )}
                </div>
                {isSelected && <Check className="h-5 w-5 text-accent flex-shrink-0 ml-auto mt-1" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        {currentIndex > 0 && (
          <Button variant="outline" className="flex-1 min-h-[52px]" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={selectedScore === undefined}
          className="flex-1 min-h-[52px] bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {currentIndex < totalDomains - 1 ? (
            <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
          ) : (
            "Review"
          )}
        </Button>
      </div>
    </div>
  );
}
