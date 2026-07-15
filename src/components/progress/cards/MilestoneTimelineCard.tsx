import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subWeeks } from "date-fns";
import { Award } from "lucide-react";
import CardShell from "../CardShell";
import type { ProgressCardProps } from "../types";

/**
 * Window for the timeline. Milestones outside the window are collapsed
 * into a summary count so early wins aren't lost.
 */
const WINDOW_WEEKS = 12;

const MilestoneTimelineCard = ({ participantId }: ProgressCardProps) => {
  const since = subWeeks(new Date(), WINDOW_WEEKS).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["progress-milestones", participantId, WINDOW_WEEKS],
    enabled: !!participantId,
    queryFn: async () => {
      const [recent, all] = await Promise.all([
        supabase
          .from("participant_milestones")
          .select("id, unlocked_at, milestone_definitions:milestone_id(name)")
          .eq("participant_id", participantId)
          .gte("unlocked_at", since)
          .order("unlocked_at", { ascending: false }),
        supabase
          .from("participant_milestones")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participantId),
      ]);
      if (recent.error) throw recent.error;
      return {
        recent: recent.data ?? [],
        totalCount: all.count ?? 0,
      };
    },
  });

  const recent = data?.recent ?? [];
  const olderCount = Math.max((data?.totalCount ?? 0) - recent.length, 0);

  return (
    <CardShell
      title="Milestone Timeline"
      subtitle={`Milestones unlocked in the last ${WINDOW_WEEKS} weeks`}
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (data?.totalCount ?? 0) === 0 ? (
        <EarlyState
          message="No milestones unlocked yet."
          hint="Milestones unlock automatically as you meet program criteria."
        />
      ) : recent.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
          <p className="text-sm text-foreground">
            {olderCount} milestone{olderCount === 1 ? "" : "s"} unlocked before this window.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            No new unlocks in the last {WINDOW_WEEKS} weeks.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {recent.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <Award className="h-4 w-4 text-accent shrink-0" />
                <span className="text-sm text-foreground flex-1 truncate">
                  {(m.milestone_definitions as { name: string } | null)?.name ?? "Milestone"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(m.unlocked_at), "MMM d")}
                </span>
              </li>
            ))}
          </ul>
          {olderCount > 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              + {olderCount} earlier milestone{olderCount === 1 ? "" : "s"} not shown.
            </p>
          )}
        </div>
      )}
    </CardShell>
  );
};

const EarlyState = ({ message, hint }: { message: string; hint: string }) => (
  <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
    <p className="text-sm text-foreground">{message}</p>
    <p className="text-xs text-muted-foreground mt-1">{hint}</p>
  </div>
);

export default MilestoneTimelineCard;
