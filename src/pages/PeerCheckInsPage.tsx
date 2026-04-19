import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const MOOD_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Crisis", color: "bg-red-500" },
  2: { label: "Struggling", color: "bg-orange-400" },
  3: { label: "Getting By", color: "bg-amber-400" },
  4: { label: "Good", color: "bg-teal-500" },
  5: { label: "Thriving", color: "bg-green-500" },
};

const PeerCheckInsPage = () => {
  const { user } = useAuth();

  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["peer-caseload-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id, first_name, last_name")
        .eq("assigned_peer_id", user!.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const participantIds = participants.map((p) => p.id);

  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["peer-recent-checkins", participantIds],
    enabled: participantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_checkins")
        .select("id, participant_id, checkin_date, mood_status, summary")
        .in("participant_id", participantIds)
        .order("checkin_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const participantMap = Object.fromEntries(
    participants.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ")])
  );

  if (loadingParticipants) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-4">Check-Ins</h1>
        <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
        <h1 className="text-xl font-bold text-foreground">Check-Ins</h1>
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No check-ins yet. Check-ins will appear here once you have participants assigned to your caseload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">Recent Check-Ins</h1>

      {loadingCheckins ? (
        <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
          Loading check-ins…
        </div>
      ) : checkins.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No check-ins recorded yet. Visit a participant's page to log one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {checkins.map((c) => {
            const mood = MOOD_CONFIG[c.mood_status] ?? MOOD_CONFIG[3];
            const name = participantMap[c.participant_id] ?? "Participant";
            return (
              <Link
                key={c.id}
                to={`/caseload/${c.participant_id}`}
                className="block bg-card border border-border rounded-xl p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-3 w-3 rounded-full shrink-0 ${mood.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        · {format(new Date(c.checkin_date), "MMM d, yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">· {mood.label}</span>
                    </div>
                    {c.summary && (
                      <p className="text-sm text-foreground/80 mt-1 line-clamp-2">{c.summary}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PeerCheckInsPage;
