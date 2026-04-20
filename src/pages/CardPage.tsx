import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Star } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { emitEvent } from "@/lib/events";
import { channels } from "@/lib/realtime-channels";
import TodaySection from "@/components/card/TodaySection";
import StreakStats from "@/components/card/StreakStats";
import RcSparkline from "@/components/card/RcSparkline";
import QuickActionFab from "@/components/card/QuickActionFab";
import AskYourPeerCard from "@/components/card/AskYourPeerCard";
import ReflectionJournal from "@/components/card/ReflectionJournal";
import ResourceOfTheDay from "@/components/card/ResourceOfTheDay";
import LevelRoadmapModal from "@/components/card/LevelRoadmapModal";

type CardLevel = Database["public"]["Enums"]["card_level"];

const LEVEL_LABELS: Record<CardLevel, string> = {
  rookie: "ROOKIE",
  starter: "STARTER",
  veteran: "VETERAN",
  all_star: "ALL-STAR",
};

const LEVEL_STYLES: Record<CardLevel, string> = {
  rookie: "bg-[#A0A0A0] text-white",
  starter: "bg-[#2563EB] text-white",
  veteran: "bg-[#1A4A4A] text-white",
  all_star: "bg-[#C5792A] text-white",
};

const LEVEL_ORDER: CardLevel[] = ["rookie", "starter", "veteran", "all_star"];

const CardPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [celebrating, setCelebrating] = useState(false);
  const prevLevelRef = useRef<CardLevel | null>(null);

  // Participant profile with program
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

  // Realtime subscription on participant_profiles for card_level changes
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(channels.cardLevel(profile.id))
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participant_profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const newLevel = (payload.new as any).card_level as CardLevel;
          const oldLevel = prevLevelRef.current;

          // Invalidate profile query to refresh all data
          queryClient.invalidateQueries({ queryKey: ["participant-card", user?.id] });
          queryClient.invalidateQueries({ queryKey: ["milestone-stats", profile.id] });
          queryClient.invalidateQueries({ queryKey: ["recent-milestones", profile.id] });

          // Check for level-up
          if (oldLevel && newLevel !== oldLevel) {
            const oldIdx = LEVEL_ORDER.indexOf(oldLevel);
            const newIdx = LEVEL_ORDER.indexOf(newLevel);
            if (newIdx > oldIdx) {
              // Level up!
              setCelebrating(true);
              toast.success(`🎉 You've reached ${LEVEL_LABELS[newLevel]} level!`, {
                duration: 5000,
              });

              // Emit level_up event (audit + participant notification).
              // See docs/interdependency-map.md → "level_up".
              emitEvent("level_up", {
                target_type: "participant_profile",
                target_id: profile.id,
                metadata: { from: oldLevel, to: newLevel },
                recipients: [
                  {
                    user_id: user!.id,
                    type: "level_up",
                    title: `Level Up: ${LEVEL_LABELS[newLevel]}!`,
                    body: `Congratulations! You've reached ${LEVEL_LABELS[newLevel]} level.`,
                    link: "/card",
                  },
                ],
              });

              setTimeout(() => setCelebrating(false), 4500);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, user?.id, queryClient]);

  // Realtime subscription on participant_milestones for new unlocks
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(channels.milestones(profile.id))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participant_milestones",
          filter: `participant_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["milestone-stats", profile.id] });
          queryClient.invalidateQueries({ queryKey: ["recent-milestones", profile.id] });
          queryClient.invalidateQueries({ queryKey: ["unread-milestone-notifications", user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, user?.id, queryClient]);

  // Realtime subscription on assessment_sessions for confirmation updates
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(channels.assessments(profile.id))
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "assessment_sessions",
          filter: `participant_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rc-scores", profile.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);

  // Track previous level
  useEffect(() => {
    if (profile?.card_level) {
      prevLevelRef.current = profile.card_level as CardLevel;
    }
  }, [profile?.card_level]);

  // Assigned peer (name + photo for Stage 3)
  const { data: peer } = useQuery({
    queryKey: ["assigned-peer", profile?.assigned_peer_id],
    enabled: !!profile?.assigned_peer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name, photo_url")
        .eq("user_id", profile!.assigned_peer_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Pending peer request (for Stage 2)
  const { data: pendingRequest } = useQuery({
    queryKey: ["my-pending-peer-request", profile?.id],
    enabled: !!profile?.id && !profile?.assigned_peer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_requests")
        .select("id, peer_specialist_id, requested_at")
        .eq("participant_id", profile!.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: peerData } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", data.peer_specialist_id)
        .maybeSingle();
      return { ...data, peer: peerData };
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

  // Latest 2 RC scores (for trend) — include unconfirmed
  const { data: assessmentData } = useQuery({
    queryKey: ["rc-scores", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("assessment_sessions")
        .select("overall_score, confirmed_by")
        .eq("participant_id", profile!.id)
        .order("completed_at", { ascending: false })
        .limit(2);
      return data ?? [];
    },
  });

  const latestAssessment = assessmentData?.[0] ?? null;
  const prevAssessment = assessmentData?.[1] ?? null;
  const rcScore = latestAssessment?.overall_score ?? null;
  const isUnconfirmed = latestAssessment ? !latestAssessment.confirmed_by : false;
  const trendIndicator = (() => {
    if (!latestAssessment || !prevAssessment) return null;
    const diff = (latestAssessment.overall_score ?? 0) - (prevAssessment.overall_score ?? 0);
    if (diff > 0) return "↑";
    if (diff < 0) return "↓";
    return "→";
  })();

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

  // Unread milestone notifications
  const { data: unreadMilestoneCount } = useQuery({
    queryKey: ["unread-milestone-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .eq("type", "milestone_unlocked");
      return count ?? 0;
    },
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

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
  const level = (profile.card_level ?? "rookie") as CardLevel;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      {/* Unread milestone banner */}
      {!bannerDismissed && (unreadMilestoneCount ?? 0) > 0 && (
        <Link
          to="/milestones"
          className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-xl px-4 py-3"
        >
          <span className="text-sm font-medium text-foreground">
            🎉 You have {unreadMilestoneCount} new milestone{unreadMilestoneCount !== 1 ? "s" : ""}!
          </span>
          <button
            onClick={(e) => { e.preventDefault(); setBannerDismissed(true); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </Link>
      )}

      {/* === TODAY SECTION (Phase 2A) === */}
      <TodaySection
        participantId={profile.id}
        participantUserId={profile.user_id}
        participantName={fullName}
      />

      {/* === BASEBALL CARD === */}
      <div className={`rounded-2xl overflow-hidden shadow-xl ${celebrating ? "animate-level-up-glow" : ""}`}>
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
            <Link to="/milestones" className="cursor-pointer">
              <StatBox
                value={`${milestoneStats?.earned ?? 0} / ${milestoneStats?.total ?? 0}`}
                label="Milestones"
              />
            </Link>
            <RcSparkline participantId={profile.id} />
          </div>

          {/* Streak stats (Phase 2B) */}
          <StreakStats participantId={profile.id} />
        </div>

        {/* ROW 3 — Level badge (tap to open roadmap) */}
        <button
          type="button"
          onClick={() => setRoadmapOpen(true)}
          className={`w-full flex items-center justify-center py-3 gap-2 transition-colors duration-500 hover:opacity-90 ${LEVEL_STYLES[level]}`}
          aria-label="View level roadmap"
        >
          {level === "all_star" && <Star className="h-5 w-5 fill-current" />}
          <span className="font-extrabold text-lg tracking-widest">
            ⚾ {LEVEL_LABELS[level]}
          </span>
          {level === "all_star" && <Star className="h-5 w-5 fill-current" />}
        </button>
      </div>

      {/* === CONVERSATION SURFACES (Phase 2C) === */}
      <div className="space-y-3">
        <AskYourPeerCard participantId={profile.id} />
        <ReflectionJournal participantId={profile.id} />
        <ResourceOfTheDay />
      </div>

      {/* === JOURNEY STAGE BANNER === */}
      {profile.assigned_peer_id && peer ? (
        // STAGE 3 — Connected
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 dark:bg-emerald-950/30 dark:border-emerald-900">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Step 3 of 3
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">
              You're Connected! 🎉
            </p>
          </div>
          <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-emerald-100 dark:border-emerald-900">
            <Avatar className="h-12 w-12 border-2 border-emerald-200 dark:border-emerald-800">
              {peer.photo_url ? <AvatarImage src={peer.photo_url} alt="" /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {(peer.first_name?.[0] ?? "") + (peer.last_name?.[0] ?? "")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">
                {peer.first_name} {peer.last_name}
              </p>
              <p className="text-xs text-muted-foreground">Your peer specialist</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Reach out anytime through the app.
          </p>
          <Button
            disabled
            className="w-full bg-primary text-primary-foreground opacity-70 cursor-not-allowed"
          >
            Send Message (coming soon)
          </Button>
        </div>
      ) : pendingRequest ? (
        // STAGE 2 — Request pending
        <div className="bg-accent/10 border border-accent/40 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-accent uppercase tracking-wide">
            Step 2 of 3
          </p>
          <p className="text-base font-bold text-foreground">Request Pending</p>
          <p className="text-sm text-muted-foreground">
            Your peer specialist request has been submitted and is being reviewed by our team.
            You'll receive a notification when it's approved — usually within 1–2 business days.
          </p>
          {pendingRequest.peer && (
            <p className="text-sm text-foreground pt-1">
              Requested:{" "}
              <span className="font-semibold">
                {pendingRequest.peer.first_name} {pendingRequest.peer.last_name}
              </span>
            </p>
          )}
        </div>
      ) : (
        // STAGE 1 — No peer, no request
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              Step 1 of 3
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">
              Find Your Peer Specialist
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse our peer specialists and send a connection request. Your peer will be
            your guide through your recovery journey.
          </p>
          <Button
            asChild
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link to="/peers/browse">Browse Peer Specialists →</Link>
          </Button>
        </div>
      )}

      {/* Below card */}
      <Button asChild variant="outline" className="w-full">
        <Link to="/profile">My Profile</Link>
      </Button>

      {/* Assessment section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Recovery Capital Assessment
        </h2>
        {assessmentData && assessmentData.length > 0 ? (
          <div className="bg-card rounded-lg px-4 py-3 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Score</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-foreground">{rcScore}</span>
                {trendIndicator && (
                  <span className={`text-sm font-bold ${trendIndicator === "↑" ? "text-green-600" : trendIndicator === "↓" ? "text-red-500" : "text-muted-foreground"}`}>
                    {trendIndicator}
                  </span>
                )}
                {isUnconfirmed && (
                  <span className="text-xs text-muted-foreground ml-1">(unconfirmed)</span>
                )}
              </div>
            </div>
            <Link
              to="/assessment/take"
              className="inline-flex items-center gap-1 text-sm text-accent font-medium hover:underline"
            >
              Retake Assessment <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-4 space-y-2">
            <p className="text-sm text-foreground font-medium">No assessment yet.</p>
            <Button asChild size="sm" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link to="/assessment/take">Start Your Recovery Capital Assessment →</Link>
            </Button>
          </div>
        )}
      </div>

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

      {/* Quick action FAB (Phase 2B) */}
      <QuickActionFab
        participantId={profile.id}
        participantUserId={profile.user_id}
        participantName={fullName}
        hasPeer={!!profile.assigned_peer_id}
      />

      {/* Level roadmap modal (Phase 2C) */}
      <LevelRoadmapModal
        open={roadmapOpen}
        onOpenChange={setRoadmapOpen}
        participantId={profile.id}
        currentLevel={level}
      />
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
