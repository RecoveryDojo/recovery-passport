import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const ParticipantMilestonesPage = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["participant-profile-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: definitions } = useQuery({
    queryKey: ["milestone-definitions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_definitions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: earned } = useQuery({
    queryKey: ["participant-milestones-earned", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_milestones")
        .select("*, milestone_definitions:milestone_id(name), peer_specialist_profiles:unlocked_by(first_name, last_name)")
        .eq("participant_id", profile!.id);
      if (error) throw error;
      return data;
    },
  });

  const earnedMap = new Map(
    (earned ?? []).map((e) => [e.milestone_id, e])
  );

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <Link
        to="/card"
        className="inline-flex items-center gap-1 text-sm text-accent font-medium hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to My Card
      </Link>

      <h1 className="text-xl font-bold text-foreground">My Milestones</h1>
      <p className="text-sm text-muted-foreground">
        {earnedMap.size} of {definitions?.length ?? 0} earned
      </p>

      <ul className="space-y-3">
        {definitions?.map((def) => {
          const unlock = earnedMap.get(def.id);
          if (unlock) {
            const peerProfile = unlock.peer_specialist_profiles as any;
            const verifierName = peerProfile
              ? `${peerProfile.first_name} ${peerProfile.last_name}`.trim()
              : "Staff";
            return (
              <li
                key={def.id}
                className="bg-card border border-border rounded-xl px-4 py-3 space-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{def.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Verified by {verifierName} on{" "}
                      {format(new Date(unlock.unlocked_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                {unlock.note && (
                  <p className="text-sm text-muted-foreground italic pl-11">
                    {unlock.note}
                  </p>
                )}
              </li>
            );
          }

          return (
            <li
              key={def.id}
              className="bg-muted/30 border border-border/50 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-muted-foreground">{def.name}</p>
                  {def.description && (
                    <p className="text-xs text-muted-foreground/70">
                      {def.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ParticipantMilestonesPage;
