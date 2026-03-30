import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Check, X, Clock, AlertCircle, ChevronRight, Heart } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

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

const CaseloadPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Peer specialist's own profile for name
  const { data: peerProfile } = useQuery({
    queryKey: ["my-peer-profile", user?.id],
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

  // Pending requests
  const { data: pendingRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["pending-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_requests")
        .select(`
          id,
          participant_id,
          requested_at,
          participant_profiles!peer_requests_participant_id_fkey (
            id, user_id, first_name, last_name, photo_url, recovery_start_date, pathway,
            programs:current_program_id ( name )
          )
        `)
        .eq("peer_specialist_id", user!.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Assigned participants (caseload)
  const { data: caseload = [], isLoading: loadingCaseload } = useQuery({
    queryKey: ["caseload", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select(`
          id, user_id, first_name, last_name, photo_url, card_level,
          recovery_start_date, pathway,
          programs:current_program_id ( name )
        `)
        .eq("assigned_peer_id", user!.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Milestone counts for caseload participants
  const participantIds = caseload.map((p) => p.id);
  const { data: milestoneCounts = {} } = useQuery({
    queryKey: ["caseload-milestones", participantIds],
    enabled: participantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_milestones")
        .select("participant_id")
        .in("participant_id", participantIds);
      const counts: Record<string, number> = {};
      data?.forEach((m) => {
        counts[m.participant_id] = (counts[m.participant_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Latest check-in dates for caseload participants
  const { data: lastCheckins = {} } = useQuery({
    queryKey: ["caseload-checkins", participantIds],
    enabled: participantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_checkins")
        .select("participant_id, checkin_date")
        .in("participant_id", participantIds)
        .order("checkin_date", { ascending: false });
      const map: Record<string, string> = {};
      data?.forEach((c) => {
        if (!map[c.participant_id]) map[c.participant_id] = c.checkin_date;
      });
      return map;
    },
  });

  // Total milestone definitions count
  const { data: totalMilestones = 12 } = useQuery({
    queryKey: ["total-milestones"],
    queryFn: async () => {
      const { count } = await supabase
        .from("milestone_definitions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return count ?? 12;
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (request: typeof pendingRequests[0]) => {
      const pp = request.participant_profiles as any;
      // Update request status
      const { error: reqErr } = await supabase
        .from("peer_requests")
        .update({ status: "approved" as any, responded_at: new Date().toISOString() })
        .eq("id", request.id);
      if (reqErr) throw reqErr;

      // Assign peer to participant
      const { error: assignErr } = await supabase
        .from("participant_profiles")
        .update({ assigned_peer_id: user!.id })
        .eq("id", pp.id);
      if (assignErr) throw assignErr;

      // Notify participant
      const peerName = peerProfile
        ? `${peerProfile.first_name} ${peerProfile.last_name}`.trim()
        : "Your peer specialist";
      await supabase.from("notifications").insert({
        user_id: pp.user_id,
        type: "peer_request_approved" as any,
        title: "Peer request approved",
        body: `Your peer specialist request was approved. ${peerName} is now your peer specialist.`,
        link: "/card",
      });
    },
    onSuccess: () => {
      toast.success("Request approved");
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["caseload"] });
    },
    onError: () => toast.error("Failed to approve request"),
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async (request: typeof pendingRequests[0]) => {
      const pp = request.participant_profiles as any;
      const { error } = await supabase
        .from("peer_requests")
        .update({ status: "declined" as any, responded_at: new Date().toISOString() })
        .eq("id", request.id);
      if (error) throw error;

      if (pp.user_id) {
        await supabase.from("notifications").insert({
          user_id: pp.user_id,
          type: "peer_request_declined" as any,
          title: "Peer request declined",
          body: "Your peer specialist request was declined. You can request a different peer specialist.",
          link: "/peers/browse",
        });
      }
    },
    onSuccess: () => {
      toast.success("Request declined");
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
    },
    onError: () => toast.error("Failed to decline request"),
  });

  // Self-care check banner
  const { data: lastSelfCare } = useQuery({
    queryKey: ["last-self-care", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("self_care_checks")
        .select("created_at")
        .eq("peer_specialist_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const selfCareOverdue = !lastSelfCare || differenceInDays(new Date(), new Date(lastSelfCare.created_at)) > 14;

  const isLoading = loadingRequests || loadingCaseload;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading caseload…</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Caseload</h1>

      {/* Self-care banner */}
      {selfCareOverdue && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Heart className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 font-medium">
              💛 Time for your self-care check-in. This is private — just for you.
            </p>
          </div>
          <Link to="/crps/selfcare">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
              Take a Moment →
            </Button>
          </Link>
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent" />
            Pending Requests ({pendingRequests.length})
          </h2>
          {pendingRequests.map((req) => {
            const pp = req.participant_profiles as any;
            const name = [pp?.first_name, pp?.last_name].filter(Boolean).join(" ") || "Unknown";
            const initials = (pp?.first_name?.[0] ?? "") + (pp?.last_name?.[0] ?? "");
            const programName = (pp?.programs as any)?.name ?? "No program";
            const daysInRecovery = pp?.recovery_start_date
              ? differenceInDays(new Date(), new Date(pp.recovery_start_date))
              : null;
            const pathwayLabel = pp?.pathway
              ? pp.pathway.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : null;

            return (
              <div key={req.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {pp?.photo_url ? <AvatarImage src={pp.photo_url} alt={name} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{name}</p>
                    <p className="text-sm text-muted-foreground">{programName}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {pathwayLabel && (
                    <Badge variant="secondary">{pathwayLabel}</Badge>
                  )}
                  {daysInRecovery != null && (
                    <Badge variant="outline">{daysInRecovery} days in recovery</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={() => approveMutation.mutate(req)}
                    disabled={approveMutation.isPending || declineMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => declineMutation.mutate(req)}
                    disabled={approveMutation.isPending || declineMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Caseload */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Assigned Participants ({caseload.length})
        </h2>

        {caseload.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-muted-foreground text-sm">
              No participants assigned yet. Approve pending requests to start building your caseload.
            </p>
          </div>
        ) : (
          caseload.map((participant) => {
            const name = [participant.first_name, participant.last_name].filter(Boolean).join(" ") || "Unknown";
            const initials = (participant.first_name?.[0] ?? "") + (participant.last_name?.[0] ?? "");
            const programName = (participant.programs as any)?.name ?? "No program";
            const daysInRecovery = participant.recovery_start_date
              ? differenceInDays(new Date(), new Date(participant.recovery_start_date))
              : 0;
            const level = (participant.card_level ?? "rookie") as CardLevel;
            const earned = milestoneCounts[participant.id] ?? 0;
            const lastCheckin = lastCheckins[participant.id];
            const daysSinceCheckin = lastCheckin
              ? differenceInDays(new Date(), new Date(lastCheckin))
              : null;

            let statusColor = "bg-muted";
            let statusIcon = <AlertCircle className="h-3 w-3" />;
            if (daysSinceCheckin != null) {
              if (daysSinceCheckin <= 7) {
                statusColor = "bg-green-500";
                statusIcon = <Check className="h-3 w-3 text-white" />;
              } else if (daysSinceCheckin <= 14) {
                statusColor = "bg-amber-500";
                statusIcon = <Clock className="h-3 w-3 text-white" />;
              } else {
                statusColor = "bg-red-500";
                statusIcon = <AlertCircle className="h-3 w-3 text-white" />;
              }
            }

            return (
              <Link
                key={participant.id}
                to={`/caseload/${participant.id}`}
                className="block bg-card border border-border rounded-xl p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      {participant.photo_url ? (
                        <AvatarImage src={participant.photo_url} alt={name} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {initials || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center ${statusColor}`}>
                      {statusIcon}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{name}</p>
                      <Badge className={`text-[10px] px-1.5 py-0 ${LEVEL_STYLES[level]}`}>
                        {LEVEL_LABELS[level]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{programName}</p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>

                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{daysInRecovery} days</span>
                  <span>{earned} / {totalMilestones} milestones</span>
                  <span>
                    {lastCheckin
                      ? `Last check-in ${daysSinceCheckin}d ago`
                      : "No check-ins yet"}
                  </span>
                </div>

                {/* Overdue check-in banner */}
                {(daysSinceCheckin === null || daysSinceCheckin > 7) && (
                  <div className="mt-2 bg-red-100 text-red-700 text-xs font-medium rounded-md px-3 py-1.5">
                    {daysSinceCheckin === null
                      ? "Check-in overdue — no check-ins recorded"
                      : `Check-in overdue — ${daysSinceCheckin} days since last check-in`}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
};

export default CaseloadPage;
