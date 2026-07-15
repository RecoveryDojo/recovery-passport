import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import CardShell from "../CardShell";
import type { ProgressCardProps } from "../types";

/**
 * Per-phase progress on the current recovery plan.
 * Not date-windowed — plans are inherently phase-based, not week-based.
 * Included here for parity with the extension pattern (WINDOW_WEEKS unused).
 */
const WINDOW_WEEKS = null;

const PHASE_LABELS: Record<string, string> = {
  thirty_day: "30-Day Phase",
  sixty_day: "60-Day Phase",
  ninety_day: "90-Day Phase",
  six_month: "6-Month Phase",
};

const RecoveryPlanCard = ({ participantId }: ProgressCardProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["progress-plan", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data: plan } = await supabase
        .from("recovery_plans")
        .select("id")
        .eq("participant_id", participantId)
        .eq("is_current", true)
        .maybeSingle();
      if (!plan) return null;

      const { data: phases } = await supabase
        .from("plan_phases")
        .select("id, phase, title, is_active")
        .eq("plan_id", plan.id);

      const phaseIds = (phases ?? []).map((p) => p.id);
      if (phaseIds.length === 0) return { phases: [] };

      const { data: steps } = await supabase
        .from("plan_action_steps")
        .select("id, phase_id, is_completed")
        .in("phase_id", phaseIds);

      const summary = (phases ?? []).map((p) => {
        const own = (steps ?? []).filter((s) => s.phase_id === p.id);
        const done = own.filter((s) => s.is_completed).length;
        return {
          id: p.id,
          phase: p.phase as string,
          title: p.title as string,
          is_active: !!p.is_active,
          total: own.length,
          done,
        };
      });
      // sort by phase order
      const order = ["thirty_day", "sixty_day", "ninety_day", "six_month"];
      summary.sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
      return { phases: summary };
    },
  });

  if (isLoading) {
    return (
      <CardShell title="Recovery Plan Progress" subtitle="Steps completed per phase">
        <p className="text-xs text-muted-foreground">Loading…</p>
      </CardShell>
    );
  }

  if (!data || data.phases.length === 0) {
    return (
      <CardShell title="Recovery Plan Progress" subtitle="Steps completed per phase">
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
          <p className="text-sm text-foreground">Recovery plan not generated yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            A plan is created automatically after the first Recovery Capital assessment.
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell title="Recovery Plan Progress" subtitle="Steps completed per phase">
      <div className="space-y-3">
        {data.phases.map((p) => {
          const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {PHASE_LABELS[p.phase] ?? p.title}
                  </span>
                  {p.is_active && (
                    <Badge className="text-[9px] bg-accent/15 text-accent border border-accent/30">
                      Active
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {p.done} / {p.total || 0}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          );
        })}
      </div>
    </CardShell>
  );
};

export default RecoveryPlanCard;
