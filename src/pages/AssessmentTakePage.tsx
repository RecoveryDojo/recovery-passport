import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

const AssessmentTakePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["participant-profile-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id, assigned_peer_id, first_name, last_name")
        .eq("user_id", user!.id)
        .single();
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

  if (!domains || !allLevels || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
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
    if (currentIndex < totalDomains - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleBack = () => {
    if (showResults) {
      setShowResults(false);
    } else if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // 1. Count existing sessions to determine if this is the first
      const { count: existingCount } = await supabase
        .from("assessment_sessions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", profile.id);

      const isFirst = (existingCount ?? 0) === 0;

      // 2. Insert assessment session
      const { data: session, error: sessErr } = await supabase
        .from("assessment_sessions")
        .insert({
          participant_id: profile.id,
          initiated_by: user!.id,
          overall_score: parseFloat(overallScore),
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      // 3. Insert scores
      const scoreRows = domains.map((d) => ({
        session_id: session.id,
        domain_id: d.id,
        score: scores[d.id],
      }));
      const { error: scoresErr } = await supabase
        .from("assessment_scores")
        .insert(scoreRows);
      if (scoresErr) throw scoresErr;

      // 4. If first assessment, generate recovery plan
      if (isFirst) {
        await supabase.rpc("generate_recovery_plan", {
          p_participant_id: profile.id,
        });
      }

      // 5. Notify assigned peer
      if (profile.assigned_peer_id) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "A participant";
        await supabase.from("notifications").insert({
          user_id: profile.assigned_peer_id,
          type: "assessment_ready_for_review" as const,
          title: "Assessment ready for review",
          body: `${name} completed their Recovery Capital Assessment.`,
          link: `/caseload/${profile.id}`,
        });
      }

      toast.success("Assessment submitted!");
      navigate("/card");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assessment");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- RESULTS SCREEN ----------
  if (showResults) {
    return (
      <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-xl font-bold text-foreground">Your Recovery Capital Assessment</h1>

        <div className="text-center py-4">
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
                  <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${(s / 5) * 100}%` }} />
                </div>
                {level && (
                  <p className="text-xs text-muted-foreground">{level.label}: {level.description}</p>
                )}
              </div>
            );
          })}
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {submitting ? "Submitting…" : "Submit Assessment"}
        </Button>
      </div>
    );
  }

  // ---------- DOMAIN STEP ----------
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
      <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {currentIndex === 0 ? "Cancel" : "Back"}
      </button>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Domain {currentIndex + 1} of {totalDomains}
        </p>
        <Progress value={((currentIndex + 1) / totalDomains) * 100} className="h-2" />
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">{currentDomain.name}</h1>
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

      <Button
        onClick={handleNext}
        disabled={selectedScore === undefined}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        {currentIndex < totalDomains - 1 ? (
          <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
        ) : (
          "Review Results"
        )}
      </Button>
    </div>
  );
};

export default AssessmentTakePage;

