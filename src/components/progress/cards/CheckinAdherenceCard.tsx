import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, subWeeks, addWeeks, isAfter } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import CardShell from "../CardShell";
import type { ProgressCardProps } from "../types";

/** Weeks of check-in history shown as bars. */
const WINDOW_WEEKS = 12;

/**
 * Weekly check-in adherence — one bar per week, colored by mood_status.
 * Empty weeks show as muted stubs so a missed week is visible, not invisible.
 */
const CheckinAdherenceCard = ({ participantId }: ProgressCardProps) => {
  const since = subWeeks(new Date(), WINDOW_WEEKS);

  const { data: checkins, isLoading } = useQuery({
    queryKey: ["progress-checkins", participantId, WINDOW_WEEKS],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_checkins")
        .select("id, checkin_date, mood_status")
        .eq("participant_id", participantId)
        .gte("checkin_date", format(since, "yyyy-MM-dd"))
        .order("checkin_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const bars = useMemo(() => {
    const buckets: Array<{ weekStart: Date; label: string; mood: number | null; count: number }> = [];
    const start = startOfWeek(since, { weekStartsOn: 1 });
    const now = new Date();
    let cursor = start;
    while (!isAfter(cursor, now)) {
      buckets.push({
        weekStart: cursor,
        label: format(cursor, "M/d"),
        mood: null,
        count: 0,
      });
      cursor = addWeeks(cursor, 1);
    }
    (checkins ?? []).forEach((c) => {
      const d = new Date(c.checkin_date);
      const ws = startOfWeek(d, { weekStartsOn: 1 }).getTime();
      const b = buckets.find((x) => x.weekStart.getTime() === ws);
      if (b) {
        b.count += 1;
        // keep the highest mood if there are multiple in a week
        b.mood = Math.max(b.mood ?? 0, c.mood_status);
      }
    });
    return buckets.map((b) => ({
      label: b.label,
      value: b.count > 0 ? b.mood ?? 1 : 0,
      hasCheckin: b.count > 0,
    }));
  }, [checkins, since]);

  const totalCheckins = (checkins ?? []).length;
  const weeksWithCheckin = bars.filter((b) => b.hasCheckin).length;
  const adherencePct = bars.length > 0 ? Math.round((weeksWithCheckin / bars.length) * 100) : 0;

  const moodColor = (v: number) => {
    if (v >= 5) return "hsl(142 71% 45%)";
    if (v >= 4) return "hsl(var(--primary))";
    if (v >= 3) return "hsl(38 92% 50%)";
    if (v >= 2) return "hsl(24 95% 53%)";
    if (v >= 1) return "hsl(0 84% 60%)";
    return "hsl(var(--muted))";
  };

  return (
    <CardShell
      title="Check-in Adherence"
      subtitle={`Last ${WINDOW_WEEKS} weeks · bar color = mood`}
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : totalCheckins === 0 ? (
        <EarlyState
          message="No check-ins recorded yet."
          hint="Weekly check-ins build a rhythm — the chart fills in as they're logged."
        />
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-foreground">{totalCheckins}</span>
            <span className="text-xs text-muted-foreground">
              check-in{totalCheckins === 1 ? "" : "s"} · {weeksWithCheckin}/{bars.length} weeks ({adherencePct}%)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={bars} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => (v === 0 ? "no check-in" : `mood ${v}/5`)}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {bars.map((b, i) => (
                  <Cell
                    key={i}
                    fill={b.hasCheckin ? moodColor(b.value) : "hsl(var(--muted))"}
                    opacity={b.hasCheckin ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {totalCheckins < 3 && (
            <p className="text-[11px] text-muted-foreground">
              Early days — patterns become visible after 3+ weekly check-ins.
            </p>
          )}
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

export default CheckinAdherenceCard;
