import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

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
        .select("id, overall_score, completed_at, confirmed_by, initiated_by")
        .eq("participant_id", profileId!)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const { data: expandedScores } = useQuery({
    queryKey: ["assessment-scores-expanded", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores")
        .select("domain_id, score, assessment_domains:domain_id(name)")
        .eq("session_id", expandedId!);
      if (error) throw error;
      return data;
    },
  });

  const chartData = sessions
    ?.slice()
    .reverse()
    .map((s) => ({
      date: format(new Date(s.completed_at), "MMM d"),
      score: Number(s.overall_score ?? 0),
    }));

  return (
    <div className="space-y-6 pb-8">
      <Link
        to="/card"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Card
      </Link>

      <h1 className="text-xl font-bold text-foreground">Assessment History</h1>

      {/* Chart */}
      {chartData && chartData.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Recovery Capital Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--accent))", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* List */}
      {!sessions || sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">No assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isExpanded = expandedId === s.id;
            const isConfirmed = !!s.confirmed_by;
            const scoreColor =
              (s.overall_score ?? 0) <= 2
                ? "text-destructive"
                : (s.overall_score ?? 0) <= 3
                ? "text-accent"
                : "text-green-600";

            return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(s.completed_at), "MMM d, yyyy")}
                    </p>
                    <p className={`text-lg font-bold ${scoreColor}`}>{s.overall_score}</p>
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
                    {expandedScores?.map((sc) => {
                      const domainName = (sc.assessment_domains as any)?.name ?? "Domain";
                      const barColor =
                        sc.score <= 2 ? "bg-destructive" : sc.score === 3 ? "bg-accent" : "bg-green-500";
                      return (
                        <div key={sc.domain_id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-foreground">{domainName}</span>
                            <span className="font-semibold text-foreground">{sc.score}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${(sc.score / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
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
