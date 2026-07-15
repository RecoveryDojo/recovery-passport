import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subWeeks } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import CardShell from "../CardShell";
import type { ProgressCardProps } from "../types";

/** Lookback window for clinical instrument trends. */
const WINDOW_WEEKS = 12;
const MIN_POINTS_FOR_TREND = 2;

const STROKES = ["hsl(var(--accent))", "#e04b4b", "#4b8ce0", "#7d4be0", "#2f855a"];

type SessionRow = {
  id: string;
  overall_score: number | null;
  completed_at: string;
  instrument_id: string;
};
type InstrumentRow = {
  id: string;
  title: string;
  higher_is_better: boolean;
  min_score: number | null;
  max_score: number | null;
};

/**
 * Clinical instrument trends (PHQ-9, GAD-7, PCL-5, AUDIT, ACE, …).
 *
 * Filters `instrument_id IS NOT NULL` — the mirror of the RC card's filter.
 * Draws one line per instrument. Valence label ("lower is better" /
 * "higher is better") comes straight from `assessment_instruments`.
 */
const AssessmentTrendsCard = ({ participantId }: ProgressCardProps) => {
  const since = subWeeks(new Date(), WINDOW_WEEKS).toISOString();

  const { data: sessions } = useQuery({
    queryKey: ["progress-assessments", participantId, WINDOW_WEEKS],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_sessions")
        .select("id, overall_score, completed_at, instrument_id")
        .eq("participant_id", participantId)
        .not("instrument_id", "is", null)
        .not("overall_score", "is", null)
        .gte("completed_at", since)
        .order("completed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const instrumentIds = useMemo(
    () => Array.from(new Set((sessions ?? []).map((s) => s.instrument_id))),
    [sessions]
  );

  const { data: instruments } = useQuery({
    queryKey: ["progress-assessments-instruments", instrumentIds],
    enabled: instrumentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments")
        .select("id, title, higher_is_better, min_score, max_score")
        .in("id", instrumentIds);
      if (error) throw error;
      return (data ?? []) as InstrumentRow[];
    },
  });

  const instMap = useMemo(() => {
    const m: Record<string, InstrumentRow> = {};
    (instruments ?? []).forEach((i) => (m[i.id] = i));
    return m;
  }, [instruments]);

  const usedInstruments = useMemo(() => {
    const list: InstrumentRow[] = [];
    const seen = new Set<string>();
    (sessions ?? []).forEach((s) => {
      const inst = instMap[s.instrument_id];
      if (inst && !seen.has(inst.id)) {
        seen.add(inst.id);
        list.push(inst);
      }
    });
    return list;
  }, [sessions, instMap]);

  const chartData = useMemo(() => {
    if (!sessions) return [];
    const byDay: Record<string, Record<string, number>> = {};
    sessions.forEach((s) => {
      const inst = instMap[s.instrument_id];
      if (!inst) return;
      const day = format(new Date(s.completed_at), "MMM d");
      byDay[day] = byDay[day] ?? { date: day } as any;
      byDay[day][inst.title] = Number(s.overall_score);
    });
    return Object.values(byDay).map((row: any) => row) as Array<Record<string, any>>;
  }, [sessions, instMap]);

  const totalPoints = (sessions ?? []).length;

  return (
    <CardShell
      title="Assessment Trends"
      subtitle={`Last ${WINDOW_WEEKS} weeks · PHQ-9, GAD-7, and other clinical instruments`}
    >
      {!sessions ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : totalPoints === 0 ? (
        <EarlyState
          message="No clinical assessments yet."
          hint="Assigned assessments (PHQ-9, GAD-7, etc.) appear here after completion."
        />
      ) : totalPoints < MIN_POINTS_FOR_TREND ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {usedInstruments.map((i) => (
              <Badge key={i.id} variant="outline" className="text-xs">
                {i.title}
              </Badge>
            ))}
          </div>
          <EarlyState
            message={`${totalPoints} assessment recorded.`}
            hint="A trend line appears after a repeat assessment."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {usedInstruments.map((i) => (
              <Badge key={i.id} variant="outline" className="text-[10px]">
                {i.title}
                {i.higher_is_better === false && (
                  <span className="ml-1 text-muted-foreground">↓ better</span>
                )}
              </Badge>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {usedInstruments.map((inst, i) => (
                <Line
                  key={inst.id}
                  type="monotone"
                  dataKey={inst.title}
                  stroke={STROKES[i % STROKES.length]}
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground">
            Each instrument has its own scale. For symptom scales (PHQ-9, GAD-7, PCL-5) lower is better.
          </p>
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

export default AssessmentTrendsCard;
