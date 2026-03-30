import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, Clock, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

const PeerBrowsePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switchTarget, setSwitchTarget] = useState<{ id: string; name: string } | null>(null);

  // Current participant profile
  const { data: profile } = useQuery({
    queryKey: ["my-participant-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id, assigned_peer_id, first_name, last_name")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Current assigned peer name
  const { data: assignedPeer } = useQuery({
    queryKey: ["assigned-peer-name", profile?.assigned_peer_id],
    enabled: !!profile?.assigned_peer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name, user_id")
        .eq("user_id", profile!.assigned_peer_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Available approved peers
  const { data: peers } = useQuery({
    queryKey: ["browse-peers"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_specialist_profiles")
        .select("user_id, first_name, last_name, bio, specialties, photo_url")
        .eq("is_available", true)
        .eq("approval_status", "approved");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pending requests for this participant
  const { data: pendingRequest } = useQuery({
    queryKey: ["my-pending-request", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_requests")
        .select("id, peer_specialist_id, status")
        .eq("participant_id", profile!.id)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Send request mutation
  const sendRequest = useMutation({
    mutationFn: async (peerUserId: string) => {
      if (!profile) throw new Error("No profile");

      // Cancel existing pending request first if any
      if (pendingRequest) {
        await supabase
          .from("peer_requests")
          .update({ status: "cancelled" as any, responded_at: new Date().toISOString() })
          .eq("id", pendingRequest.id);
      }

      const { error } = await supabase
        .from("peer_requests")
        .insert({
          participant_id: profile.id,
          peer_specialist_id: peerUserId,
        });
      if (error) throw error;

      // Send notification to the peer
      const participantName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "A participant";
      await supabase.from("notifications").insert({
        user_id: peerUserId,
        type: "peer_request_received" as const,
        title: "New Peer Request",
        body: `${participantName} has requested you as their peer specialist.`,
        link: "/caseload",
      });
    },
    onSuccess: (_, peerUserId) => {
      const peer = peers?.find((p) => p.user_id === peerUserId);
      const name = peer ? `${peer.first_name} ${peer.last_name}`.trim() : "peer";
      toast.success(`Request sent to ${name}.`);
      queryClient.invalidateQueries({ queryKey: ["my-pending-request"] });
      setSwitchTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send request");
    },
  });

  // Cancel request mutation
  const cancelRequest = useMutation({
    mutationFn: async () => {
      if (!pendingRequest) return;
      const { error } = await supabase
        .from("peer_requests")
        .update({ status: "cancelled" as any, responded_at: new Date().toISOString() })
        .eq("id", pendingRequest.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request cancelled.");
      queryClient.invalidateQueries({ queryKey: ["my-pending-request"] });
    },
  });

  const handleRequestClick = (peerUserId: string, peerName: string) => {
    if (pendingRequest && pendingRequest.peer_specialist_id !== peerUserId) {
      const currentPeer = peers?.find((p) => p.user_id === pendingRequest.peer_specialist_id);
      const currentName = currentPeer ? `${currentPeer.first_name} ${currentPeer.last_name}`.trim() : "another peer";
      setSwitchTarget({ id: peerUserId, name: peerName });
    } else {
      sendRequest.mutate(peerUserId);
    }
  };

  const pendingPeerName = (() => {
    if (!pendingRequest) return "";
    const p = peers?.find((pr) => pr.user_id === pendingRequest.peer_specialist_id);
    return p ? `${p.first_name} ${p.last_name}`.trim() : "another peer";
  })();

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/card")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-primary">Browse Peer Specialists</h1>
      </div>

      {/* Current assignment notice */}
      {assignedPeer && (
        <div className="bg-primary/10 rounded-xl px-4 py-3">
          <p className="text-sm text-foreground">
            You're currently working with{" "}
            <span className="font-semibold">{assignedPeer.first_name} {assignedPeer.last_name}</span>.
            You can request a different peer if needed.
          </p>
        </div>
      )}

      {/* Pending request banner */}
      {pendingRequest && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent shrink-0" />
            <p className="text-sm text-foreground">
              Request pending to <span className="font-semibold">{pendingPeerName}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive text-xs shrink-0"
            onClick={() => cancelRequest.mutate()}
            disabled={cancelRequest.isPending}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Peer list */}
      {peers && peers.length > 0 ? (
        <div className="space-y-3">
          {peers.map((peer) => {
            const initials = (peer.first_name?.[0] ?? "") + (peer.last_name?.[0] ?? "");
            const name = `${peer.first_name} ${peer.last_name}`.trim();
            const isAssigned = profile?.assigned_peer_id === peer.user_id;
            const isPending = pendingRequest?.peer_specialist_id === peer.user_id;

            return (
              <Card key={peer.user_id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="h-14 w-14 shrink-0 border-2 border-border">
                      {peer.photo_url ? <AvatarImage src={peer.photo_url} alt={name} /> : null}
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {initials || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground">{name}</h3>
                      {peer.bio && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{peer.bio}</p>
                      )}
                      {peer.specialties && peer.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {peer.specialties.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    {isAssigned ? (
                      <Button variant="outline" size="sm" className="w-full text-primary" disabled>
                        <Check className="mr-1.5 h-4 w-4" /> Your Peer
                      </Button>
                    ) : isPending ? (
                      <Button variant="outline" size="sm" className="w-full text-muted-foreground" disabled>
                        <Clock className="mr-1.5 h-4 w-4" /> Request Pending
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={() => handleRequestClick(peer.user_id, name)}
                        disabled={sendRequest.isPending}
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" /> Request
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No peer specialists available right now.</p>
        </div>
      )}

      {/* Switch confirmation dialog */}
      <AlertDialog open={!!switchTarget} onOpenChange={(open) => !open && setSwitchTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch request?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a pending request to {pendingPeerName}. Would you like to cancel that one and request {switchTarget?.name} instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => switchTarget && sendRequest.mutate(switchTarget.id)}
            >
              Yes, switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PeerBrowsePage;
