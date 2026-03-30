import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { Lock, Check, ChevronRight, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

const PHASE_ORDER = ["thirty_day", "sixty_day", "ninety_day", "six_month"] as const;
const PHASE_LABELS: Record<string, string> = {
  thirty_day: "30 Day",
  sixty_day: "60 Day",
  ninety_day: "90 Day",
  six_month: "6 Mo",
};

const PlanPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["participant-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id, user_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: plan } = useQuery({
    queryKey: ["recovery-plan", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_plans")
        .select("id")
        .eq("participant_id", profile!.id)
        .eq("is_current", true)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });

  const { data: phases } = useQuery({
    queryKey: ["plan-phases", plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_phases")
        .select("id, phase, title, focus_description, is_active")
        .eq("plan_id", plan!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: allSteps } = useQuery({
    queryKey: ["plan-steps", plan?.id, phases?.map((p) => p.id)],
    enabled: !!plan?.id && !!phases && phases.length > 0,
    queryFn: async () => {
      const phaseIds = phases!.map((p) => p.id);
      const { data, error } = await supabase
        .from("plan_action_steps")
        .select("id, phase_id, description, is_completed, completed_at, sort_order")
        .in("phase_id", phaseIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Active tab state — default to first active phase
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const sortedPhases = phases
    ? [...phases].sort(
        (a, b) => PHASE_ORDER.indexOf(a.phase as any) - PHASE_ORDER.indexOf(b.phase as any)
      )
    : [];

  // Set default active tab
  const effectiveTab =
    activeTab && sortedPhases.some((p) => p.phase === activeTab && p.is_active)
      ? activeTab
      : sortedPhases.find((p) => p.is_active)?.phase ?? null;

  const currentPhase = sortedPhases.find((p) => p.phase === effectiveTab);
  const currentSteps = allSteps?.filter((s) => s.phase_id === currentPhase?.id) ?? [];
  const completedCount = currentSteps.filter((s) => s.is_completed).length;
  const totalCount = currentSteps.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const toggleStepMutation = useMutation({
    mutationFn: async ({ stepId, completed, phaseId }: { stepId: string; completed: boolean; phaseId: string }) => {
      const { error } = await supabase
        .from("plan_action_steps")
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", stepId);
      if (error) throw error;

      // After toggling ON, re-fetch fresh step counts from DB to check phase unlock
      if (completed) {
        const { data: freshSteps } = await supabase
          .from("plan_action_steps")
          .select("id, is_completed")
          .eq("phase_id", phaseId);

        if (freshSteps) {
          const total = freshSteps.length;
          const done = freshSteps.filter((s) => s.is_completed).length;
          const pct = total > 0 ? done / total : 0;

          if (pct >= 0.8) {
            // Find the phase we're in and the next one
            const phase = sortedPhases.find((p) => p.id === phaseId);
            if (phase) {
              const currentIdx = PHASE_ORDER.indexOf(phase.phase as any);
              const nextPhase = sortedPhases[currentIdx + 1];
              if (nextPhase && !nextPhase.is_active) {
                await supabase
                  .from("plan_phases")
                  .update({ is_active: true })
                  .eq("id", nextPhase.id);

                if (profile?.user_id) {
                  await supabase.from("notifications").insert({
                    user_id: profile.user_id,
                    type: "plan_updated" as const,
                    title: "New Phase Unlocked!",
                    body: `${PHASE_LABELS[nextPhase.phase]} phase is now available in your recovery plan!`,
                    link: "/plan",
                  });
                }

                toast.success(`${PHASE_LABELS[nextPhase.phase]} phase is now unlocked! 🎉`);
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-steps", plan?.id] });
      queryClient.invalidateQueries({ queryKey: ["plan-phases", plan?.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // --- No plan state ---
  if (profile && plan === null) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold text-foreground">My Recovery Plan</h1>
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Your recovery plan will be generated automatically after you complete your first
            Recovery Capital Assessment.
          </p>
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link to="/assessment/take">
              Start Assessment <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!phases || !allSteps) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-sm">Loading plan…</p>
      </div>
    );
  }

  // Helper: get phase completion for tab styling
  const getPhaseStatus = (phase: (typeof sortedPhases)[0]) => {
    const steps = allSteps.filter((s) => s.phase_id === phase.id);
    const done = steps.filter((s) => s.is_completed).length;
    const allDone = steps.length > 0 && done === steps.length;
    return { isActive: phase.is_active, allDone };
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-foreground">My Recovery Plan</h1>

      {/* Phase tabs */}
      <div className="flex gap-2">
        {sortedPhases.map((phase) => {
          const { isActive, allDone } = getPhaseStatus(phase);
          const isSelected = phase.phase === effectiveTab;

          return (
            <button
              key={phase.id}
              disabled={!isActive}
              onClick={() => setActiveTab(phase.phase)}
              className={cn(
                "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                !isActive && "bg-muted text-muted-foreground cursor-not-allowed",
                isActive && allDone && "bg-green-600 text-white",
                isActive && !allDone && isSelected && "bg-primary text-primary-foreground",
                isActive && !allDone && !isSelected && "bg-primary/20 text-primary hover:bg-primary/30"
              )}
            >
              {!isActive && <Lock className="h-3 w-3" />}
              {allDone && <Check className="h-3 w-3" />}
              {PHASE_LABELS[phase.phase]}
            </button>
          );
        })}
      </div>

      {/* Phase content */}
      {currentPhase && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{currentPhase.title}</h2>
            {currentPhase.focus_description && (
              <p className="text-sm text-muted-foreground italic mt-1">
                {currentPhase.focus_description}
              </p>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} of {totalCount} steps complete</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-3 [&>div]:bg-accent" />
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {currentSteps.map((step) => (
              <label
                key={step.id}
                className={cn(
                  "flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3 cursor-pointer transition-colors",
                  step.is_completed && "bg-accent/5 border-accent/20"
                )}
              >
                <Checkbox
                  checked={step.is_completed}
                  disabled={toggleStepMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleStepMutation.mutate({
                      stepId: step.id,
                      completed: !!checked,
                      phaseId: step.phase_id,
                    })
                  }
                  className="mt-0.5"
                />
                <span
                  className={cn(
                    "text-sm text-foreground",
                    step.is_completed && "line-through text-muted-foreground"
                  )}
                >
                  {step.description}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanPage;
