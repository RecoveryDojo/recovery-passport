import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MOOD_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Crisis", color: "bg-red-500" },
  2: { label: "Struggling", color: "bg-orange-400" },
  3: { label: "Getting By", color: "bg-amber-400" },
  4: { label: "Good", color: "bg-teal-500" },
  5: { label: "Thriving", color: "bg-green-500" },
};

interface CheckInsTabProps {
  participantId: string;
  viewerRole: "participant" | "peer" | "admin";
}

const CheckInsTab = ({ participantId, viewerRole }: CheckInsTabProps) => {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["checkin-history", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_checkins")
        .select("*")
        .eq("participant_id", participantId)
        .order("checkin_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Get peer names for all checkins
  const peerIds = [...new Set(checkins.map((c) => c.peer_specialist_id))];
  const { data: peerProfiles = {} } = useQuery({
    queryKey: ["peer-names", peerIds],
    enabled: peerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", peerIds);
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        map[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Peer Specialist";
      });
      return map;
    },
  });

  // Supervisor feedback for checkins (peer & admin only)
  const checkinIds = checkins.map((c) => c.id);
  const { data: feedback = {} } = useQuery({
    queryKey: ["checkin-feedback", checkinIds],
    enabled: checkinIds.length > 0 && viewerRole !== "participant",
    queryFn: async () => {
      const { data } = await supabase
        .from("supervisor_feedback")
        .select("*")
        .eq("target_type", "checkin")
        .in("target_id", checkinIds);
      const map: Record<string, { feedback: string; created_at: string }> = {};
      data?.forEach((f) => {
        map[f.target_id] = { feedback: f.feedback, created_at: f.created_at };
      });
      return map;
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
        Loading check-ins…
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">No check-ins recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {checkins.map((checkin) => {
        const mood = MOOD_CONFIG[checkin.mood_status] ?? MOOD_CONFIG[3];
        const isExpanded = expandedId === checkin.id;
        const isFeedbackOpen = feedbackOpenId === checkin.id;
        const peerName = peerProfiles[checkin.peer_specialist_id] ?? "Peer Specialist";
        const isOwnCheckin = user?.id === checkin.peer_specialist_id;
        const hasFeedback = !!feedback[checkin.id];

        return (
          <div
            key={checkin.id}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            {/* Header — always visible */}
            <button
              className="w-full p-4 text-left"
              onClick={() => setExpandedId(isExpanded ? null : checkin.id)}
            >
              <div className="flex items-start gap-3">
                {/* Mood dot */}
                <span className={`mt-1 h-3 w-3 rounded-full shrink-0 ${mood.color}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {format(new Date(checkin.checkin_date), "MMM d, yyyy")}
                    </span>
                    <span className="text-xs text-muted-foreground">· {mood.label}</span>
                    {viewerRole !== "participant" && isOwnCheckin && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        By you
                      </Badge>
                    )}
                    {viewerRole !== "participant" && hasFeedback && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeedbackOpenId(isFeedbackOpen ? null : checkin.id);
                        }}
                        className="text-accent hover:text-accent/80"
                        title="Supervisor feedback"
                      >
                        <MessageSquare className="h-4 w-4 fill-current" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Logged by {peerName}
                  </p>
                  {checkin.summary && !isExpanded && (
                    <p className="text-sm text-foreground/80 mt-1 line-clamp-2">
                      {checkin.summary}
                    </p>
                  )}
                </div>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </div>
            </button>

            {/* Supervisor feedback panel */}
            {isFeedbackOpen && hasFeedback && (
              <div className="mx-4 mb-3 bg-accent/10 border border-accent/20 rounded-lg p-3">
                <p className="text-xs font-medium text-accent mb-1">Supervisor Feedback</p>
                <p className="text-sm text-foreground/80">{feedback[checkin.id].feedback}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(feedback[checkin.id].created_at), "MMM d, yyyy")}
                </p>
              </div>
            )}

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {checkin.summary && (
                  <DetailSection label="Summary" value={checkin.summary} />
                )}
                {checkin.plan_progress_notes && (
                  <DetailSection label="Plan Progress" value={checkin.plan_progress_notes} />
                )}
                {checkin.barriers && (
                  <DetailSection label="Barriers" value={checkin.barriers} />
                )}
                {checkin.next_steps && (
                  <DetailSection label="Next Steps" value={checkin.next_steps} />
                )}
                {checkin.mi_techniques_used && checkin.mi_techniques_used.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">MI Techniques</p>
                    <div className="flex flex-wrap gap-1">
                      {checkin.mi_techniques_used.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const DetailSection = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{value}</p>
  </div>
);

export default CheckInsTab;
