import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emitEvent } from "@/lib/events";

interface TodayFocusCardProps {
  participantId: string;
}

const TodayFocusCard = ({ participantId }: TodayFocusCardProps) => {
  const { data: summary } = useParticipantClinicalSummary(participantId);
  const queryClient = useQueryClient();

  // First incomplete step in active phase
  const focus = summary?.planSteps.find((s) => !s.is_completed) ?? null;

  const completeStep = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase
        .from("plan_action_steps")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", stepId);
      if (error) throw error;
      await emitEvent("plan_step.completed", {
        target_type: "plan_action_step",
        target_id: stepId,
        metadata: { participantId, source: "self" },
      });
    },
    onSuccess: () => {
      toast.success("Nice work — one step closer 👏");
      queryClient.invalidateQueries({ queryKey: ["participant-clinical-summary", participantId] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't complete step"),
  });

  if (!summary) return null;

  if (!summary.activePhase) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-1">Today's focus</p>
        <p className="text-xs text-muted-foreground">
          Your recovery plan will appear once your first assessment is confirmed.
        </p>
      </div>
    );
  }

  if (!focus) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-1">Today's focus</p>
        <p className="text-xs text-muted-foreground">
          🎉 You've completed every step in {summary.activePhase.title}!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Today's focus</p>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {summary.activePhase.title}
        </span>
      </div>
      <button
        type="button"
        onClick={() => completeStep.mutate(focus.id)}
        disabled={completeStep.isPending}
        className={cn(
          "w-full flex items-center gap-3 text-left rounded-lg p-3 border transition-all",
          "border-border bg-muted/30 hover:bg-accent/10 active:scale-[0.99]",
          completeStep.isPending && "opacity-60 cursor-wait"
        )}
      >
        <span className="h-6 w-6 rounded-full border-2 border-accent flex items-center justify-center shrink-0">
          <Check className="h-3.5 w-3.5 text-accent opacity-0" />
        </span>
        <span className="text-sm text-foreground flex-1">{focus.description}</span>
      </button>
    </div>
  );
};

export default TodayFocusCard;
