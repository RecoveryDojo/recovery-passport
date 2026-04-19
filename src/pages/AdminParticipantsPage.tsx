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
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, UserCheck, UserX } from "lucide-react";

const AdminParticipantsPage = () => {
  const [tab, setTab] = useState("pending");
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Pending peer requests
  const { data: pendingRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ["admin-pending-peer-requests"],
    queryFn: async () => {
      const { data: requests, error } = await supabase
        .from("peer_requests")
        .select("id, participant_id, peer_specialist_id, requested_at, status")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      if (!requests || requests.length === 0) return [];

      const participantIds = [...new Set(requests.map((r) => r.participant_id))];
      const peerUserIds = [...new Set(requests.map((r) => r.peer_specialist_id))];

      const [{ data: participants }, { data: peers }] = await Promise.all([
        supabase
          .from("participant_profiles")
          .select("id, first_name, last_name")
          .in("id", participantIds),
        supabase
          .from("peer_specialist_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", peerUserIds),
      ]);

      const pMap = Object.fromEntries((participants ?? []).map((p) => [p.id, p]));
      const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, p]));

      return requests.map((r) => ({
        ...r,
        participant: pMap[r.participant_id],
        peer: peerMap[r.peer_specialist_id],
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
      const peerIds = [...new Set(profiles.map((p) => p.assigned_peer_id).filter(Boolean) as string[])];

      const [{ data: users }, { data: peers }] = await Promise.all([
        supabase.from("users").select("id, email").in("id", userIds),
        peerIds.length > 0
          ? supabase
              .from("peer_specialist_profiles")
              .select("user_id, first_name, last_name")
              .in("user_id", peerIds)
          : Promise.resolve({ data: [] as { user_id: string; first_name: string; last_name: string }[] }),
      ]);

      const uMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
      const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, p]));

      return profiles.map((p) => ({
        ...p,
        email: uMap[p.user_id]?.email ?? "—",
        peer: p.assigned_peer_id ? peerMap[p.assigned_peer_id] : null,
      }));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (request: {
      id: string;
      participant_id: string;
      peer_specialist_id: string;
    }) => {
      const now = new Date().toISOString();

      const { error: reqErr } = await supabase
        .from("peer_requests")
        .update({ status: "approved", responded_at: now })
        .eq("id", request.id);
      if (reqErr) throw reqErr;

      const { error: profErr } = await supabase
        .from("participant_profiles")
        .update({ assigned_peer_id: request.peer_specialist_id })
        .eq("id", request.participant_id);
      if (profErr) throw profErr;

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user?.id,
        action: "approve_peer_request",
        target_type: "peer_requests",
        target_id: request.id,
        metadata: {
          participant_id: request.participant_id,
          peer_specialist_id: request.peer_specialist_id,
        },
      });

      // Notify participant
      const participant = pendingRequests?.find((r) => r.id === request.id)?.participant;
      const peer = pendingRequests?.find((r) => r.id === request.id)?.peer;
      const participantUserRes = await supabase
        .from("participant_profiles")
        .select("user_id")
        .eq("id", request.participant_id)
        .maybeSingle();

      if (participantUserRes.data?.user_id) {
        await supabase.from("notifications").insert({
          user_id: participantUserRes.data.user_id,
          type: "peer_request_approved" as const,
          title: "Peer Request Approved",
          body: peer
            ? `Your request to work with ${peer.first_name} ${peer.last_name} has been approved.`
            : "Your peer specialist request has been approved.",
          link: "/card",
        });
      }

      return { participant, peer };
    },
    onSuccess: ({ participant, peer }) => {
      const pName = participant ? `${participant.first_name} ${participant.last_name}` : "Participant";
      const peerName = peer ? `${peer.first_name} ${peer.last_name}` : "the peer specialist";
      toast({
        title: "Approved",
        description: `${pName} is now assigned to ${peerName}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-peer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-participants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-peer-caseloads"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("peer_requests")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;

      await supabase.from("audit_log").insert({
        user_id: user?.id,
        action: "decline_peer_request",
        target_type: "peer_requests",
        target_id: requestId,
      });
    },
    onSuccess: () => {
      toast({ title: "Request declined" });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-peer-requests"] });
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
          Approve peer specialist assignments and manage participants.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending Requests
            {pendingRequests && pendingRequests.length > 0 && ` (${pendingRequests.length})`}
          </TabsTrigger>
          <TabsTrigger value="all">
            All Participants
            {allParticipants && allParticipants.length > 0 && ` (${allParticipants.length})`}
          </TabsTrigger>
        </TabsList>

        {/* PENDING REQUESTS */}
        <TabsContent value="pending" className="mt-4 space-y-3">
          {loadingRequests ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
          ) : !pendingRequests || pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No pending peer requests.
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{fullName(req.participant)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Requested <span className="font-medium text-foreground">{fullName(req.peer)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(req.requested_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        approveMutation.mutate({
                          id: req.id,
                          participant_id: req.participant_id,
                          peer_specialist_id: req.peer_specialist_id,
                        })
                      }
                      disabled={approveMutation.isPending || declineMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => declineMutation.mutate(req.id)}
                      disabled={approveMutation.isPending || declineMutation.isPending}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ALL PARTICIPANTS */}
        <TabsContent value="all" className="mt-4 space-y-3">
          {loadingAll ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
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
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{fullName(p)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {days !== null ? `${days} day${days === 1 ? "" : "s"} in recovery` : "Recovery start date not set"}
                      </p>
                    </div>
                    <div>
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
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminParticipantsPage;
