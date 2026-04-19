import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, UserCheck, UserX, Clock, ChevronRight } from "lucide-react";
import AdminParticipantDetailSheet from "@/components/AdminParticipantDetailSheet";

type Peer = { user_id: string; first_name: string; last_name: string };

type AllParticipantRow = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  recovery_start_date: string | null;
  assigned_peer_id: string | null;
  email: string;
  peer: Peer | null | undefined;
};

const AdminParticipantsPage = () => {
  const [tab, setTab] = useState("needs");
  const [detailParticipant, setDetailParticipant] = useState<AllParticipantRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (p: AllParticipantRow) => {
    setDetailParticipant(p);
    setDetailOpen(true);
  };
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // All approved peer specialists (for assignment dropdowns)
  const { data: approvedPeers } = useQuery({
    queryKey: ["admin-approved-peers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_specialist_profiles")
        .select("user_id, first_name, last_name")
        .eq("approval_status", "approved")
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Peer[];
    },
  });

  // Unassigned participants + any pending peer_requests for context
  const { data: needsAssignment, isLoading: loadingNeeds } = useQuery({
    queryKey: ["admin-needs-assignment"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("participant_profiles")
        .select("id, user_id, first_name, last_name, recovery_start_date")
        .is("assigned_peer_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map((p) => p.user_id);
      const profileIds = profiles.map((p) => p.id);

      const [{ data: users }, { data: requests }] = await Promise.all([
        supabase.from("users").select("id, email").in("id", userIds),
        supabase
          .from("peer_requests")
          .select("id, participant_id, peer_specialist_id, requested_at")
          .eq("status", "pending")
          .in("participant_id", profileIds),
      ]);

      const peerUserIds = [...new Set((requests ?? []).map((r) => r.peer_specialist_id))];
      const { data: peers } = peerUserIds.length
        ? await supabase
            .from("peer_specialist_profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", peerUserIds)
        : { data: [] as Peer[] };

      const uMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
      const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, p]));
      const reqMap = Object.fromEntries(
        (requests ?? []).map((r) => [
          r.participant_id,
          { ...r, peer: peerMap[r.peer_specialist_id] as Peer | undefined },
        ])
      );

      return profiles.map((p) => ({
        ...p,
        email: uMap[p.user_id]?.email ?? "—",
        pendingRequest: reqMap[p.id] ?? null,
      }));
    },
  });

  // All participants
  const { data: allParticipants, isLoading: loadingAll } = useQuery({
    queryKey: ["admin-all-participants"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("participant_profiles")
        .select("id, user_id, first_name, last_name, recovery_start_date, assigned_peer_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map((p) => p.user_id);
      const peerIds = [
        ...new Set(profiles.map((p) => p.assigned_peer_id).filter(Boolean) as string[]),
      ];

      const [{ data: users }, { data: peers }] = await Promise.all([
        supabase.from("users").select("id, email").in("id", userIds),
        peerIds.length > 0
          ? supabase
              .from("peer_specialist_profiles")
              .select("user_id, first_name, last_name")
              .in("user_id", peerIds)
          : Promise.resolve({ data: [] as Peer[] }),
      ]);

      const uMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
      const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, p]));

      return profiles.map((p) => ({
        ...p,
        email: uMap[p.user_id]?.email ?? "—",
        peer: p.assigned_peer_id ? (peerMap[p.assigned_peer_id] as Peer | undefined) : null,
      }));
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (args: {
      participantProfileId: string;
      participantUserId: string;
      peerUserId: string;
      pendingRequestId?: string | null;
    }) => {
      const { participantProfileId, participantUserId, peerUserId, pendingRequestId } = args;
      const now = new Date().toISOString();

      const { error: profErr } = await supabase
        .from("participant_profiles")
        .update({ assigned_peer_id: peerUserId })
        .eq("id", participantProfileId);
      if (profErr) throw profErr;

      if (pendingRequestId) {
        const { error: reqErr } = await supabase
          .from("peer_requests")
          .update({ status: "approved", responded_at: now })
          .eq("id", pendingRequestId);
        if (reqErr) throw reqErr;
      }

      await supabase.from("audit_log").insert({
        user_id: user?.id,
        action: "assign_peer",
        target_type: "participant_profiles",
        target_id: participantProfileId,
        metadata: {
          peer_specialist_id: peerUserId,
          via_request: !!pendingRequestId,
        },
      });

      const peer = approvedPeers?.find((p) => p.user_id === peerUserId);

      // Fire both notifications in parallel
      await Promise.all([
        // Notify the peer specialist
        supabase.from("notifications").insert({
          user_id: peerUserId,
          type: "new_participant" as const,
          title: "New Participant Assigned",
          body: "A new participant has been added to your caseload. Check your Caseload tab.",
          link: "/caseload",
          is_read: false,
          related_id: pendingRequestId ?? null,
          related_type: "peer_request",
        }),
        // Notify the participant
        supabase.from("notifications").insert({
          user_id: participantUserId,
          type: "general" as const,
          title: "Your Peer Specialist is Ready",
          body: "Your peer specialist has been assigned. Visit My Card to meet them.",
          link: "/card",
          is_read: false,
          related_id: pendingRequestId ?? null,
          related_type: "peer_request",
        }),
      ]);

      return { peer, viaRequest: !!pendingRequestId };
    },
    onSuccess: ({ peer, viaRequest }) => {
      toast({
        title: viaRequest ? "Approved" : "Peer assigned",
        description: viaRequest
          ? "Both parties have been notified."
          : peer
          ? `${peer.first_name} ${peer.last_name} is now assigned. Both parties notified.`
          : "Assignment saved. Both parties notified.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-needs-assignment"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-participants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-peer-caseloads"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
    p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "—" : "—";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Participants</h1>
        <p className="text-sm text-muted-foreground">
          Assign peer specialists and manage all participants.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="needs">
            Needs Assignment
            {needsAssignment && needsAssignment.length > 0 && ` (${needsAssignment.length})`}
          </TabsTrigger>
          <TabsTrigger value="all">
            All Participants
            {allParticipants && allParticipants.length > 0 && ` (${allParticipants.length})`}
          </TabsTrigger>
        </TabsList>

        {/* NEEDS ASSIGNMENT */}
        <TabsContent value="needs" className="mt-4 space-y-3">
          {loadingNeeds ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
          ) : !needsAssignment || needsAssignment.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                All participants have a peer specialist assigned. 🎉
              </CardContent>
            </Card>
          ) : (
            needsAssignment.map((p) => {
              const days =
                p.recovery_start_date != null
                  ? differenceInDays(new Date(), new Date(p.recovery_start_date))
                  : null;
              const req = p.pendingRequest;
              const isPending =
                assignMutation.isPending &&
                assignMutation.variables?.participantProfileId === p.id;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{fullName(p)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {days !== null
                            ? `${days} day${days === 1 ? "" : "s"} in recovery`
                            : "Recovery start date not set"}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                        <UserX className="h-3 w-3 mr-1" />
                        Unassigned
                      </Badge>
                    </div>

                    {req && (
                      <div className="flex items-start justify-between gap-3 p-3 rounded-md bg-muted/50 border border-border flex-wrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground">
                            Requested{" "}
                            <span className="font-medium">{fullName(req.peer)}</span>
                            <span className="text-muted-foreground">
                              {" · "}
                              {format(new Date(req.requested_at), "MMM d")}
                            </span>
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            assignMutation.mutate({
                              participantProfileId: p.id,
                              participantUserId: p.user_id,
                              peerUserId: req.peer_specialist_id,
                              pendingRequestId: req.id,
                            })
                          }
                          disabled={assignMutation.isPending}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve Request
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Assign peer:</span>
                      <Select
                        disabled={isPending || !approvedPeers?.length}
                        onValueChange={(peerUserId) =>
                          assignMutation.mutate({
                            participantProfileId: p.id,
                            participantUserId: p.user_id,
                            peerUserId,
                            pendingRequestId: req?.id ?? null,
                          })
                        }
                      >
                        <SelectTrigger className="h-9 w-full sm:w-64">
                          <SelectValue
                            placeholder={
                              approvedPeers?.length
                                ? "Choose a peer specialist..."
                                : "No approved peers available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedPeers?.map((peer) => (
                            <SelectItem key={peer.user_id} value={peer.user_id}>
                              {peer.first_name} {peer.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ALL PARTICIPANTS */}
        <TabsContent value="all" className="mt-4 space-y-3">
          {loadingAll ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
          ) : !allParticipants || allParticipants.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No participants yet.
              </CardContent>
            </Card>
          ) : (
            allParticipants.map((p) => {
              const days =
                p.recovery_start_date != null
                  ? differenceInDays(new Date(), new Date(p.recovery_start_date))
                  : null;
              const isPending =
                assignMutation.isPending &&
                assignMutation.variables?.participantProfileId === p.id;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => openDetail(p)}
                      className="w-full -m-1 p-1 rounded-md text-left hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View details for ${fullName(p)}`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{fullName(p)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {p.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {days !== null
                              ? `${days} day${days === 1 ? "" : "s"} in recovery`
                              : "Recovery start date not set"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.assigned_peer_id && p.peer ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                              <UserCheck className="h-3 w-3 mr-1" />
                              {fullName(p.peer)}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                              <UserX className="h-3 w-3 mr-1" />
                              Unassigned
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {p.assigned_peer_id ? "Reassign:" : "Assign peer:"}
                      </span>
                      <Select
                        value={p.assigned_peer_id ?? undefined}
                        disabled={isPending || !approvedPeers?.length}
                        onValueChange={(peerUserId) => {
                          if (peerUserId === p.assigned_peer_id) return;
                          assignMutation.mutate({
                            participantProfileId: p.id,
                            participantUserId: p.user_id,
                            peerUserId,
                            pendingRequestId: null,
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 w-full sm:w-64">
                          <SelectValue
                            placeholder={
                              approvedPeers?.length
                                ? "Choose a peer specialist..."
                                : "No approved peers available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedPeers?.map((peer) => (
                            <SelectItem key={peer.user_id} value={peer.user_id}>
                              {peer.first_name} {peer.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <AdminParticipantDetailSheet
        participant={detailParticipant}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};

export default AdminParticipantsPage;
