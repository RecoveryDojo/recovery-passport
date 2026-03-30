import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays } from "date-fns";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import MilestonesTab from "@/components/MilestonesTab";
import AssessmentsTab from "@/components/AssessmentsTab";
import PeerPlanTab from "@/components/PeerPlanTab";
import CheckInsTab from "@/components/CheckInsTab";
import PaymentLedger from "@/components/PaymentLedger";
import NotesTab from "@/components/NotesTab";
import TransitionsTab from "@/components/TransitionsTab";

type CardLevel = Database["public"]["Enums"]["card_level"];

const LEVEL_LABELS: Record<CardLevel, string> = {
  rookie: "ROOKIE",
  starter: "STARTER",
  veteran: "VETERAN",
  all_star: "ALL-STAR",
};

const LEVEL_STYLES: Record<CardLevel, string> = {
  rookie: "bg-[hsl(0,0%,63%)] text-white",
  starter: "bg-[hsl(217,91%,60%)] text-white",
  veteran: "bg-primary text-primary-foreground",
  all_star: "bg-accent text-accent-foreground",
};

const ParticipantDetailPage = () => {
  const { participantId } = useParams<{ participantId: string }>();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "milestones";
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["participant-detail", participantId],
    enabled: !!participantId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("*, programs:current_program_id(name)")
        .eq("id", participantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: milestoneStats } = useQuery({
    queryKey: ["milestone-stats", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const [earned, total] = await Promise.all([
        supabase
          .from("participant_milestones")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participantId!),
        supabase
          .from("milestone_definitions")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
      ]);
      return { earned: earned.count ?? 0, total: total.count ?? 0 };
    },
  });

  const { data: rcScore } = useQuery({
    queryKey: ["rc-score", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assessment_sessions")
        .select("overall_score")
        .eq("participant_id", participantId!)
        .not("confirmed_by", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.overall_score ?? null;
    },
  });

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "");
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Participant";
  const programName = (profile.programs as any)?.name ?? "No program assigned";
  const daysInRecovery = profile.recovery_start_date
    ? differenceInDays(new Date(), new Date(profile.recovery_start_date))
    : 0;
  const level = (profile.card_level ?? "rookie") as CardLevel;

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-5">
      {/* Back link */}
      <Link
        to="/caseload"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Caseload
      </Link>

      {/* Baseball Card */}
      <div className="rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-primary p-5 space-y-5">
          {/* Identity */}
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
              <h1 className="text-xl font-bold text-primary-foreground truncate">{fullName}</h1>
              <p className="text-primary-foreground/80 text-sm truncate">{programName}</p>
            </div>
          </div>

          {/* Stats */}
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

        {/* Level badge */}
        <div className={`flex items-center justify-center py-3 gap-2 ${LEVEL_STYLES[level]}`}>
          {level === "all_star" && <Star className="h-5 w-5 fill-current" />}
          <span className="font-extrabold text-lg tracking-widest">
            ⚾ {LEVEL_LABELS[level]}
          </span>
          {level === "all_star" && <Star className="h-5 w-5 fill-current" />}
        </div>
      </div>

      {/* New Check-In Button */}
      <Link to={`/caseload/${participantId}/checkin`} className="block">
        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base py-5">
          + New Check-In
        </Button>
      </Link>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full grid grid-cols-7 h-auto">
          <TabsTrigger value="milestones" className="text-xs py-2">Milestones</TabsTrigger>
          <TabsTrigger value="assessments" className="text-xs py-2">Assessments</TabsTrigger>
          <TabsTrigger value="plan" className="text-xs py-2">Plan</TabsTrigger>
          <TabsTrigger value="checkins" className="text-xs py-2">Check-Ins</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs py-2">Payments</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs py-2">Notes</TabsTrigger>
          <TabsTrigger value="transitions" className="text-xs py-2">Transitions</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="mt-4">
          <MilestonesTab
            participantId={participantId!}
            participantName={fullName}
            assignedPeerId={profile.assigned_peer_id}
          />
        </TabsContent>
        <TabsContent value="assessments" className="mt-4">
          <AssessmentsTab
            participantId={participantId!}
            participantName={fullName}
          />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <PeerPlanTab
            participantId={participantId!}
            participantUserId={profile.user_id}
          />
        </TabsContent>
        <TabsContent value="checkins" className="mt-4">
          <CheckInsTab participantId={participantId!} viewerRole="peer" />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentLedger participantId={participantId!} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesTab participantId={participantId!} participantName={fullName} viewerRole="peer" />
        </TabsContent>
        <TabsContent value="transitions" className="mt-4">
          <TransitionsTab
            participantId={participantId!}
            participantName={fullName}
            participantUserId={profile.user_id}
            viewerRole="peer"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatBox = ({ value, label }: { value: string; label: string }) => (
  <div className="bg-primary-foreground/10 rounded-xl py-3 text-center">
    <p className="text-2xl font-bold text-primary-foreground">{value}</p>
    <p className="text-xs text-primary-foreground/70 mt-0.5">{label}</p>
  </div>
);

const PlaceholderTab = ({ label }: { label: string }) => (
  <div className="bg-card border border-border rounded-xl p-6 text-center">
    <p className="text-muted-foreground text-sm">{label} — coming soon</p>
  </div>
);

export default ParticipantDetailPage;
