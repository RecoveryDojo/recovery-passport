import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Session = {
  id: string;
  overall_score: number | null;
  completed_at: string;
  confirmed_by: string | null;
  initiated_by: string;
  instrument_id: string | null;
};
type Instrument = {
  id: string;
  title: string;
  higher_is_better: boolean;
  min_score: number | null;
  max_score: number | null;
};

const INSTRUMENT_STROKES = ["hsl(var(--accent))", "hsl(var(--primary))", "#e04b4b", "#4b8ce0", "#7d4be0"];

const AssessmentHistoryPage = () => {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: profileId } = useQuery({
    queryKey: ["my-profile-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_participant_profile_id");
      return data as string;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["assessment-history", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_sessions")
        .select("id, overall_score, completed_at, confirmed_by, initiated_by, instrument_id")
        .eq("participant_id", profileId!)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  // Fetch instrument metadata for every non-null instrument_id
  const instrumentIds = useMemo(
    () => Array.from(new Set((sessions ?? []).map((s) => s.instrument_id).filter(Boolean))) as string[],
    [sessions]
  );
  const { data: instruments } = useQuery({
    queryKey: ["assessment-history-instruments", instrumentIds],
    enabled: instrumentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments")
        .select("id, title, higher_is_better, min_score, max_score")
        .in("id", instrumentIds);
      if (error) throw error;
      return data as Instrument[];
    },
  });

  const rcMeta: Instrument = {
    id: "__rc__",
    title: "Recovery Capital",
    higher_is_better: true,
    min_score: 0,
    max_score: 5,
  };

  const instrumentFor = (s: Session): Instrument =>
    s.instrument_id
      ? instruments?.find((i) => i.id === s.instrument_id) ?? { ...rcMeta, id: s.instrument_id, title: "Instrument" }
      : rcMeta;

  const colorForScore = (score: number | null, meta: Instrument): string => {
    if (score == null || meta.max_score == null || meta.min_score == null) return "text-foreground";
    const range = meta.max_score - meta.min_score || 1;
    const norm = (score - meta.min_score) / range; // 0..1
    // "concern" — higher = worse
    const concern = meta.higher_is_better ? 1 - norm : norm;
    if (concern >= 0.6) return "text-destructive";
    if (concern >= 0.35) return "text-accent";
    return "text-green-600";
  };
  const barColor = (score: number, meta: Instrument): string => {
    const range = (meta.max_score ?? 5) - (meta.min_score ?? 0) || 1;
    const norm = (score - (meta.min_score ?? 0)) / range;
    const concern = meta.higher_is_better ? 1 - norm : norm;
    if (concern >= 0.6) return "bg-destructive";
    if (concern >= 0.35) return "bg-accent";
    return "bg-green-500";
  };

  const { data: confirmerNames } = useQuery({
    queryKey: ["confirmer-names", sessions?.map((s) => s.confirmed_by).filter(Boolean)],
    enabled: !!sessions && sessions.some((s) => s.confirmed_by),
    queryFn: async () => {
      const ids = [...new Set(sessions!.map((s) => s.confirmed_by).filter(Boolean))] as string[];
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      data?.forEach((p) => { map[p.user_id] = `${p.first_name} ${p.last_name}`; });
      return map;
    },
  });

  // RC scores expand via assessment_scores; non-RC via assessment_responses
  const expandedSession = sessions?.find((s) => s.id === expandedId) ?? null;
  const { data: expandedRcScores } = useQuery({
    queryKey: ["assessment-scores-expanded", expandedId],
    enabled: !!expandedId && !!expandedSession && expandedSession.instrument_id == null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores")
        .select("domain_id, score, assessment_domains:domain_id(name)")
        .eq("session_id", expandedId!);
      if (error) throw error;
      return data;
    },
  });
  const { data: expandedResponses } = useQuery({
    queryKey: ["assessment-responses-expanded", expandedId],
    enabled: !!expandedId && !!expandedSession && expandedSession.instrument_id != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_responses")
        .select("id, points, numeric_value, text_value, flagged, item:item_id(prompt, sort_order), option:option_id(label)")
        .eq("session_id", expandedId!);
      if (error) throw error;
      return data as any[];
    },
  });

  // Chart: one line per instrument, aligned by date
  const chartData = useMemo(() => {
    if (!sessions) return [];
    const byDate: Record<string, Record<string, number>> = {};
    sessions.slice().reverse().forEach((s) => {
      if (s.overall_score == null) return;
      const meta = instrumentFor(s);
      const day = format(new Date(s.completed_at), "MMM d");
      byDate[day] = byDate[day] ?? {};
      byDate[day][meta.title] = Number(s.overall_score);
    });
    return Object.entries(byDate).map(([date, vals]) => ({ date, ...vals }));
  }, [sessions, instruments]);

  const chartInstruments = useMemo(() => {
    if (!sessions) return [] as Instrument[];
    const seen = new Set<string>();
    const list: Instrument[] = [];
    sessions.forEach((s) => {
      const m = instrumentFor(s);
      if (!seen.has(m.title)) { seen.add(m.title); list.push(m); }
    });
    return list;
  }, [sessions, instruments]);

  return (
    <div className="space-y-6 pb-8">
      <Link to="/card" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Card
      </Link>

      <h1 className="text-xl font-bold text-foreground">Assessment History</h1>

      {chartData.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Scores over time</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              {/* Y-axis auto-scales per data present. Each line is a different instrument, so
                  we let recharts derive domain rather than hardcode RC's 0–5. */}
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {chartInstruments.map((inst, i) => (
                <Line
                  key={inst.title}
                  type="monotone"
                  dataKey={inst.title}
                  stroke={INSTRUMENT_STROKES[i % INSTRUMENT_STROKES.length]}
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Each instrument uses its own scale. Higher isn't always better — PHQ-9/GAD-7 measure symptom burden.
          </p>
        </div>
      )}

      {!sessions || sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">No assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const meta = instrumentFor(s);
            const isExpanded = expandedId === s.id;
            const isConfirmed = !!s.confirmed_by;
            const scoreColor = colorForScore(s.overall_score, meta);

            return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{meta.title}</Badge>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(s.completed_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <p className={`text-lg font-bold ${scoreColor}`}>
                      {s.overall_score ?? "—"}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        / {meta.max_score ?? "?"}
                      </span>
                    </p>
                    {isConfirmed ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Check className="h-3 w-3 text-green-600" />
                        Confirmed by {confirmerNames?.[s.confirmed_by!] ?? "Peer Specialist"}
                      </p>
                    ) : (
                      <Badge variant="outline" className="mt-1 text-xs border-amber-300 text-amber-700">
                        <Clock className="h-3 w-3 mr-1" /> Pending confirmation
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    {s.instrument_id == null ? (
                      expandedRcScores?.map((sc: any) => {
                        const domainName = (sc.assessment_domains as any)?.name ?? "Domain";
                        const c = barColor(sc.score, meta);
                        return (
                          <div key={sc.domain_id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground">{domainName}</span>
                              <span className="font-semibold text-foreground">{sc.score}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${c}`}
                                style={{ width: `${(sc.score / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      (expandedResponses ?? [])
                        .slice()
                        .sort((a: any, b: any) => (a.item?.sort_order ?? 0) - (b.item?.sort_order ?? 0))
                        .map((r: any) => (
                          <div key={r.id} className="flex items-start justify-between gap-3 text-sm border-b border-border last:border-0 py-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground">{r.item?.prompt}</p>
                              {r.flagged && (
                                <Badge variant="destructive" className="text-xs mt-1">flagged</Badge>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-foreground font-medium">
                                {r.option?.label ?? r.numeric_value ?? r.text_value ?? "—"}
                              </p>
                              {r.points != null && (
                                <p className="text-xs text-muted-foreground">{r.points} pts</p>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssessmentHistoryPage;
