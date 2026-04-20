import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Ban, RotateCcw, Eye, AlertTriangle, Users, GraduationCap, Calendar, UserCheck, Shield } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type PeerProfile = Tables<"peer_specialist_profiles">;
type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

const statusBadgeVariant = (status: ApprovalStatus) => {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-800 border-amber-200";
    case "approved": return "bg-green-100 text-green-800 border-green-200";
    case "rejected": return "bg-gray-100 text-gray-600 border-gray-200";
    case "suspended": return "bg-red-100 text-red-800 border-red-200";
  }
};

const AdminPeersPage = () => {
  const [tab, setTab] = useState<string>("all");
  const [rejectPeerId, setRejectPeerId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewPeer, setReviewPeer] = useState<PeerProfile | null>(null);
  const [detailPeer, setDetailPeer] = useState<PeerProfile | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all peer specialist profiles
  const { data: peers, isLoading } = useQuery({
    queryKey: ["admin-peers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_specialist_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PeerProfile[];
    },
  });

  // Fetch caseload counts (participants assigned to each peer)
  const { data: caseloadCounts } = useQuery({
    queryKey: ["admin-peer-caseloads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("assigned_peer_id")
        .not("assigned_peer_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((p) => {
        if (p.assigned_peer_id) {
          counts[p.assigned_peer_id] = (counts[p.assigned_peer_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Update approval status mutation
  const updateStatus = useMutation({
    mutationFn: async ({
      userId,
      status,
      reason,
    }: {
      userId: string;
      status: ApprovalStatus;
      reason?: string;
    }) => {
      const updates = {
        approval_status: status,
        ...(status === "rejected" && reason ? { rejection_reason: reason } : {}),
        ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
      };

      const { error } = await supabase
        .from("peer_specialist_profiles")
        .update(updates)
        .eq("user_id", userId);
      if (error) throw error;

      // Emit peer status change → audit + notification fan-out
      const eventMap: Record<string, "peer.approved" | "peer.rejected" | "peer.suspended"> = {
        approved: "peer.approved",
        rejected: "peer.rejected",
        suspended: "peer.suspended",
      };
      const event = eventMap[status];
      if (event) {
        const recipients =
          status === "approved"
            ? [{
                user_id: userId,
                type: "peer_application_approved" as const,
                title: "Account Approved",
                body: "Your account has been approved. You can now access your caseload.",
                link: "/caseload",
              }]
            : status === "rejected"
            ? [{
                user_id: userId,
                type: "peer_application_rejected" as const,
                title: "Application Not Approved",
                body: reason || "Your application was not approved at this time.",
              }]
            : [];
        await emitEvent(event, {
          target_type: "peer_specialist_profiles",
          target_id: userId,
          metadata: { new_status: status, ...(reason ? { reason } : {}) },
          recipients,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-peers"] });
      toast({ title: "Status updated" });
      setRejectPeerId(null);
      setRejectionReason("");
    },
    onError: (e) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Approve pending edits
  const approveEdits = useMutation({
    mutationFn: async (peer: PeerProfile) => {
      if (!peer.pending_edits) return;
      const edits = peer.pending_edits as Record<string, unknown>;
      const { error } = await supabase
        .from("peer_specialist_profiles")
        .update({ ...edits, pending_edits: null })
        .eq("user_id", peer.user_id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: peer.user_id,
        type: "peer_edits_approved" as const,
        title: "Profile Changes Approved",
        body: "Your profile changes have been reviewed and approved.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-peers"] });
      toast({ title: "Changes approved" });
      setReviewPeer(null);
    },
  });

  // Reject pending edits
  const rejectEdits = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("peer_specialist_profiles")
        .update({ pending_edits: null })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-peers"] });
      toast({ title: "Changes rejected" });
      setReviewPeer(null);
    },
  });

  const filteredPeers = peers?.filter((p) => {
    if (tab === "all") return true;
    return p.approval_status === tab;
  });

  const getInitials = (p: PeerProfile) => {
    const f = p.first_name?.[0] || "";
    const l = p.last_name?.[0] || "";
    return (f + l).toUpperCase() || "?";
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Peer Specialists</h1>
        <p className="text-sm text-muted-foreground">Manage peer specialist applications and profiles</p>
        <Link to="/admin/peers/review">
          <Button variant="outline" size="sm" className="mt-2">Supervisor Review Feed</Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">
            All {peers?.length ? `(${peers.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending {peers?.filter((p) => p.approval_status === "pending").length ? `(${peers.filter((p) => p.approval_status === "pending").length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredPeers?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No peer specialists found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPeers?.map((peer) => (
            <Card key={peer.id}>
              {/* Pending edits banner */}
              {peer.pending_edits && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between rounded-t-lg">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Pending profile changes from {peer.first_name || "this peer"}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-800 border-amber-300 hover:bg-amber-100"
                    onClick={() => setReviewPeer(peer)}
                  >
                    Review Changes
                  </Button>
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <button onClick={() => setDetailPeer(peer)} className="shrink-0">
                    <Avatar className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                      <AvatarImage src={peer.photo_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                        {getInitials(peer)}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setDetailPeer(peer)}
                        className="font-semibold text-foreground hover:text-primary hover:underline transition-colors text-left"
                      >
                        {peer.first_name && peer.last_name
                          ? `${peer.first_name} ${peer.last_name}`
                          : "Incomplete Profile"}
                      </button>
                      <Badge className={`text-xs ${statusBadgeVariant(peer.approval_status as ApprovalStatus)}`}>
                        {peer.approval_status}
                      </Badge>
                      <Badge className={`text-xs ${statusBadgeVariant(peer.approval_status as ApprovalStatus)}`}>
                        {peer.approval_status}
                      </Badge>
                      {peer.is_available && peer.approval_status === "approved" && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">Available</Badge>
                      )}
                    </div>

                    {peer.specialties && peer.specialties.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {peer.specialties.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {caseloadCounts?.[peer.user_id] || 0} participants
                      </span>
                      <span>CRPS: {peer.crps_status?.replace("_", " ")}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap justify-end">
                    {peer.approval_status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ userId: peer.user_id, status: "approved" })}
                          disabled={updateStatus.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectPeerId(peer.user_id)}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {peer.approval_status === "approved" && (
                      <>
                        <Link to={`/admin/peers/${peer.user_id}`}>
                          <Button size="sm" variant="outline">
                            <GraduationCap className="h-4 w-4 mr-1" /> CRPS
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => updateStatus.mutate({ userId: peer.user_id, status: "suspended" })}
                          disabled={updateStatus.isPending}
                        >
                          <Ban className="h-4 w-4 mr-1" /> Suspend
                        </Button>
                      </>
                    )}
                    {peer.approval_status === "suspended" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus.mutate({ userId: peer.user_id, status: "approved" })}
                        disabled={updateStatus.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" /> Reinstate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectPeerId} onOpenChange={() => setRejectPeerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectPeerId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectPeerId) {
                  updateStatus.mutate({ userId: rejectPeerId, status: "rejected", reason: rejectionReason });
                }
              }}
              disabled={updateStatus.isPending}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Pending Edits Sheet */}
      <Sheet open={!!reviewPeer} onOpenChange={() => setReviewPeer(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review Profile Changes</SheetTitle>
          </SheetHeader>
          {reviewPeer?.pending_edits && (
            <div className="mt-6 space-y-4">
              {Object.entries(reviewPeer.pending_edits as Record<string, unknown>).map(([key, newValue]) => {
                const currentValue = (reviewPeer as Record<string, unknown>)[key];
                return (
                  <div key={key} className="border border-border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      {key.replace(/_/g, " ")}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Current</p>
                        <p className="text-sm bg-red-50 text-red-800 rounded p-2 break-words">
                          {Array.isArray(currentValue)
                            ? currentValue.join(", ") || "—"
                            : String(currentValue || "—")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Proposed</p>
                        <p className="text-sm bg-green-50 text-green-800 rounded p-2 break-words">
                          {Array.isArray(newValue)
                            ? (newValue as string[]).join(", ") || "—"
                            : String(newValue || "—")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => reviewPeer && approveEdits.mutate(reviewPeer)}
                  disabled={approveEdits.isPending}
                >
                  Approve Changes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => reviewPeer && rejectEdits.mutate(reviewPeer.user_id)}
                  disabled={rejectEdits.isPending}
                >
                  Reject Changes
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Detail Review Sheet */}
      <Sheet open={!!detailPeer} onOpenChange={() => setDetailPeer(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Profile Review</SheetTitle>
          </SheetHeader>
          {detailPeer && (
            <div className="mt-6 space-y-6">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-3">
                  <AvatarImage src={detailPeer.photo_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {getInitials(detailPeer)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-lg font-bold text-foreground">
                  {detailPeer.first_name} {detailPeer.last_name}
                </h2>
                <Badge className={`mt-1 text-xs ${statusBadgeVariant(detailPeer.approval_status as ApprovalStatus)}`}>
                  {detailPeer.approval_status}
                </Badge>
              </div>

              {/* Bio */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Bio</p>
                <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
                  {detailPeer.bio || <span className="italic text-muted-foreground">No bio provided</span>}
                </p>
              </div>

              {/* Specialties */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Specialties</p>
                {detailPeer.specialties && detailPeer.specialties.length > 0 ? (
                  <div className="flex gap-1 flex-wrap">
                    {detailPeer.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">None listed</p>
                )}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Availability
                  </p>
                  <p className="text-sm text-foreground">
                    {detailPeer.is_available ? "Available" : "Not Available"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> CRPS Status
                  </p>
                  <p className="text-sm text-foreground capitalize">
                    {detailPeer.crps_status?.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Caseload
                  </p>
                  <p className="text-sm text-foreground">
                    {caseloadCounts?.[detailPeer.user_id] || 0} participants
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Applied
                  </p>
                  <p className="text-sm text-foreground">
                    {new Date(detailPeer.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Rejection reason if rejected */}
              {detailPeer.approval_status === "rejected" && detailPeer.rejection_reason && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Rejection Reason</p>
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    {detailPeer.rejection_reason}
                  </p>
                </div>
              )}

              {/* Actions for pending peers */}
              {detailPeer.approval_status === "pending" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      updateStatus.mutate({ userId: detailPeer.user_id, status: "approved" });
                      setDetailPeer(null);
                    }}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setRejectPeerId(detailPeer.user_id);
                      setDetailPeer(null);
                    }}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}

              {/* Actions for approved peers */}
              {detailPeer.approval_status === "approved" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Link to={`/admin/peers/${detailPeer.user_id}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <GraduationCap className="h-4 w-4 mr-1" /> View CRPS
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      updateStatus.mutate({ userId: detailPeer.user_id, status: "suspended" });
                      setDetailPeer(null);
                    }}
                    disabled={updateStatus.isPending}
                  >
                    <Ban className="h-4 w-4 mr-1" /> Suspend
                  </Button>
                </div>
              )}

              {/* Actions for suspended peers */}
              {detailPeer.approval_status === "suspended" && (
                <div className="pt-2 border-t border-border">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      updateStatus.mutate({ userId: detailPeer.user_id, status: "approved" });
                      setDetailPeer(null);
                    }}
                    disabled={updateStatus.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Reinstate
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminPeersPage;
