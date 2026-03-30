import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { differenceInDays } from "date-fns";

const LEVEL_LABELS: Record<string, string> = {
  rookie: "ROOKIE",
  starter: "STARTER",
  veteran: "VETERAN",
  all_star: "ALL-STAR",
};

const CardPage = () => {
  const { user } = useAuth();

  // Participant profile with program + peer info
  const { data: profile } = useQuery({
    queryKey: ["participant-card", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("*, programs:current_program_id(name)")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Assigned peer name
  const { data: peer } = useQuery({
    queryKey: ["assigned-peer", profile?.assigned_peer_id],
    enabled: !!profile?.assigned_peer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", profile!.assigned_peer_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Milestone counts
  const { data: milestoneStats } = useQuery({
    queryKey: ["milestone-stats", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const [earned, total] = await Promise.all([
        supabase
          .from("participant_milestones")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", profile!.id),
        supabase
          .from("milestone_definitions")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
      ]);
      return { earned: earned.count ?? 0, total: total.count ?? 0 };
    },
  });

  // Latest RC score
  const { data: rcScore } = useQuery({
    queryKey: ["rc-score", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("assessment_sessions")
        .select("overall_score")
        .eq("participant_id", profile!.id)
        .not("confirmed_by", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.overall_score ?? null;
    },
  });

  // Recent earned milestones (last 3)
  const { data: recentMilestones } = useQuery({
    queryKey: ["recent-milestones", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_milestones")
        .select("id, unlocked_at, milestone_definitions:milestone_id(name)")
        .eq("participant_id", profile!.id)
        .order("unlocked_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const initials =
    (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "");
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "New Player";
  const programName =
    (profile.programs as any)?.name ?? "No program assigned";
  const daysInRecovery = profile.recovery_start_date
    ? differenceInDays(new Date(), new Date(profile.recovery_start_date))
    : 0;
  const level = profile.card_level ?? "rookie";

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      {/* === BASEBALL CARD === */}
      <div className="rounded-2xl overflow-hidden shadow-xl">
        {/* Card body */}
        <div className="bg-primary p-5 space-y-5">
          {/* ROW 1 — Identity */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-accent">
              {profile.photo_url ? (
                <AvatarImage src={profile.photo_url} alt={fullName} />
              ) : null}
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xl font-bold">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-primary-foreground truncate">
                {fullName}
              </h1>
              <p className="text-primary-foreground/80 text-sm truncate">
                {programName}
              </p>
              {peer ? (
                <p className="text-accent text-sm">
                  Peer: {peer.first_name} {peer.last_name}
                </p>
              ) : (
                <p className="text-accent text-sm italic">
                  No peer assigned yet
                </p>
              )}
            </div>
          </div>

          {/* ROW 2 — Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox value={String(daysInRecovery)} label="Days" />
            <StatBox
              value={`${milestoneStats?.earned ?? 0} / ${milestoneStats?.total ?? 0}`}
              label="Milestones"
            />
            <StatBox
              value={rcScore != null ? String(rcScore) : "—"}
              label="RC Score"
            />
          </div>
        </div>

        {/* ROW 3 — Level badge */}
        <div className="bg-accent flex items-center justify-center py-3">
          <span className="text-accent-foreground font-extrabold text-lg tracking-widest">
            ⚾ {LEVEL_LABELS[level] ?? "ROOKIE"}
          </span>
        </div>
      </div>

      {/* Below card */}
      <Button asChild variant="outline" className="w-full">
        <Link to="/profile">My Profile</Link>
      </Button>

      {/* Milestones preview */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Milestones
        </h2>
        {recentMilestones && recentMilestones.length > 0 ? (
          <ul className="space-y-2">
            {recentMilestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 bg-card rounded-lg px-4 py-3 border border-border"
              >
                <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-accent" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {(m.milestone_definitions as any)?.name ?? "Milestone"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No milestones earned yet — keep going!
          </p>
        )}
        <Link
          to="/milestones"
          className="inline-flex items-center gap-1 text-sm text-accent font-medium mt-3 hover:underline"
        >
          View All Milestones <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

const StatBox = ({ value, label }: { value: string; label: string }) => (
  <div className="bg-primary-foreground/10 rounded-xl py-3 text-center">
    <p className="text-2xl font-bold text-primary-foreground">{value}</p>
    <p className="text-xs text-primary-foreground/70 mt-0.5">{label}</p>
  </div>
);

export default CardPage;
