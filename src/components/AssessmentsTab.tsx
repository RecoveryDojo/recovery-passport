import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { updateCrpsCompetencies } from "@/lib/crps-updater";

interface Props {
  participantId: string;
  participantName: string;
}

const AssessmentsTab = ({ participantId, participantName }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // All sessions for this participant
  const { data: sessions } = useQuery({
    queryKey: ["assessment-sessions", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_sessions")
        .select("id, overall_score, completed_at, confirmed_by, initiated_by")
        .eq("participant_id", participantId)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Scores for the selected session
  const { data: sessionDetail } = useQuery({
    queryKey: ["assessment-detail", selectedSessionId],
    enabled: !!selectedSessionId,
    queryFn: async () => {
      const { data: scores, error } = await supabase
        .from("assessment_scores")
        .select("domain_id, score, assessment_domains:domain_id(name)")
        .eq("session_id", selectedSessionId!);
      if (error) throw error;

      // Get domain levels for descriptions
      const domainIds = scores.map((s) => s.domain_id);
      const { data: levels } = await supabase
        .from("assessment_domain_levels")
        .select("domain_id, score, label, description")
        .in("domain_id", domainIds);

      return { scores, levels: levels ?? [] };
    },
  });

  // Confirmer name
  const selectedSession = sessions?.find((s) => s.id === selectedSessionId);
  const { data: confirmerName } = useQuery({
    queryKey: ["confirmer-name", selectedSession?.confirmed_by],
    enabled: !!selectedSession?.confirmed_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", selectedSession!.confirmed_by!)
        .single();
      return data ? `${data.first_name} ${data.last_name}` : "Peer Specialist";
    },
  });

  // Get participant's user_id for notification
  const { data: participantUserId } = useQuery({
    queryKey: ["participant-user-id", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("user_id")
        .eq("id", participantId)
        .single();
      return data?.user_id ?? null;
    },
  });

  // Peer specialist profile for name in notification
  const { data: peerProfile } = useQuery({
    queryKey: ["peer-profile-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("assessment_sessions")
        .update({ confirmed_by: user!.id })
        .eq("id", sessionId);
      if (error) throw error;

      // Notify participant
      if (participantUserId) {
        const peerName = peerProfile
          ? `${peerProfile.first_name} ${peerProfile.last_name}`
          : "Your peer specialist";
        await supabase.from("notifications").insert({
          user_id: participantUserId,
          type: "general" as const,
          title: "Assessment Confirmed",
          body: `Your Recovery Capital Assessment has been reviewed and confirmed by ${peerName}.`,
          link: "/card",
        });
      }
    },
    onSuccess: () => {
      toast.success("Assessment confirmed!");
      queryClient.invalidateQueries({ queryKey: ["assessment-sessions", participantId] });
      queryClient.invalidateQueries({ queryKey: ["assessment-detail", selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ["rc-score", participantId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ---------- DETAIL VIEW ----------
  if (selectedSessionId && selectedSession) {
    const isConfirmed = !!selectedSession.confirmed_by;

    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedSessionId(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to list
        </button>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(selectedSession.completed_at), "MMM d, yyyy")}
            </p>
            <p className="text-2xl font-bold text-foreground">{selectedSession.overall_score}</p>
          </div>
          {isConfirmed ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <Check className="h-3 w-3 mr-1" /> Confirmed
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              <Clock className="h-3 w-3 mr-1" /> Needs Review
            </Badge>
          )}
        </div>

        {isConfirmed && confirmerName && (
          <p className="text-xs text-muted-foreground">
            Confirmed by {confirmerName}
          </p>
        )}

        {/* Domain scores */}
        <div className="space-y-3">
          {sessionDetail?.scores.map((s) => {
            const domainName = (s.assessment_domains as any)?.name ?? "Domain";
            const level = sessionDetail.levels.find(
              (l) => l.domain_id === s.domain_id && l.score === s.score
            );
            const color =
              s.score <= 2 ? "bg-red-400" : s.score === 3 ? "bg-accent" : "bg-green-500";

            return (
              <div key={s.domain_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{domainName}</span>
                  <span className="font-bold text-foreground">{s.score}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all`}
                    style={{ width: `${(s.score / 5) * 100}%` }}
                  />
                </div>
                {level && (
                  <p className="text-xs text-muted-foreground">
                    {level.label}: {level.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!isConfirmed && (
          <Button
            onClick={() => confirmMutation.mutate(selectedSessionId)}
            disabled={confirmMutation.isPending}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {confirmMutation.isPending ? "Confirming…" : "Confirm This Assessment"}
          </Button>
        )}
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div className="space-y-3">
      {!sessions || sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">
            {participantName} has no assessments yet.
          </p>
        </div>
      ) : (
        sessions.map((s) => {
          const scoreColor =
            (s.overall_score ?? 0) <= 2
              ? "text-red-500"
              : (s.overall_score ?? 0) <= 3
              ? "text-amber-600"
              : "text-green-600";
          const isConfirmed = !!s.confirmed_by;

          return (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(s.completed_at), "MMM d, yyyy")}
                  </p>
                  <p className={`text-lg font-bold ${scoreColor}`}>{s.overall_score}</p>
                </div>
                {isConfirmed ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                    <Check className="h-3 w-3 mr-1" /> Confirmed
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                    <Clock className="h-3 w-3 mr-1" /> Needs Review
                  </Badge>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

export default AssessmentsTab;
