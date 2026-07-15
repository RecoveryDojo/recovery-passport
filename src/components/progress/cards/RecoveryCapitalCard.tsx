import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subWeeks } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import CardShell from "../CardShell";
import type { ProgressCardProps } from "../types";

/** Lookback window for the trend line. Tune here — do not scatter elsewhere. */
const WINDOW_WEEKS = 12;
/** Minimum points needed before we draw a trend line. */
const MIN_POINTS_FOR_TREND = 3;

/**
 * Recovery Capital score over time.
 *
 * IMPORTANT: filters `instrument_id IS NULL` — the exact same filter used in
 * CardPage's rc-scores query. RC assessments are the legacy (pre-instrument)
 * table; PHQ-9 / GAD-7 / PCL-5 / AUDIT / ACE sessions all carry an
 * instrument_id and MUST NOT bleed into the RC line. See leak fix in
 * useParticipantClinicalSummary.
 */
const RecoveryCapitalCard = ({ participantId }: ProgressCardProps) => {
  const since = subWeeks(new Date(), WINDOW_WEEKS).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["progress-rc", participantId, WINDOW_WEEKS],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_sessions")
        .select("id, overall_score, completed_at")
        .eq("participant_id", participantId)
        .is("instrument_id", null)
        .not("overall_score", "is", null)
        .gte("completed_at", since)
        .order("completed_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const points = (data ?? []).map((s) => ({
    date: format(new Date(s.completed_at), "MMM d"),
    score: Number(s.overall_score),
  }));

  const latest = points[points.length - 1]?.score ?? null;
  const previous = points[points.length - 2]?.score ?? null;
  const delta = latest != null && previous != null ? latest - previous : null;

  return (
    <CardShell
      title="Recovery Capital"
      subtitle={`Last ${WINDOW_WEEKS} weeks · scale 0–5, higher is better`}
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : points.length === 0 ? (
        <EarlyState
          message="No Recovery Capital assessment yet."
          hint="Your first assessment sets the baseline for this chart."
        />
      ) : points.length < MIN_POINTS_FOR_TREND ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {latest?.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">most recent</span>
          </div>
          <EarlyState
            message={`${points.length} assessment${points.length === 1 ? "" : "s"} recorded.`}
            hint={`A trend line appears after ${MIN_POINTS_FOR_TREND} assessments.`}
          />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">
              {latest?.toFixed(1)}
            </span>
            {delta != null && (
              <span
                className={
                  delta > 0
                    ? "text-sm font-semibold text-green-600"
                    : delta < 0
                    ? "text-sm font-semibold text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <ReferenceLine y={2.5} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
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

export default RecoveryCapitalCard;
