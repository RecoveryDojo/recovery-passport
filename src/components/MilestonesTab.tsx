import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateCrpsCompetencies } from "@/lib/crps-updater";
import { format } from "date-fns";

interface MilestonesTabProps {
  participantId: string;
  participantName: string;
  assignedPeerId: string | null;
}

const MilestonesTab = ({ participantId, participantName, assignedPeerId }: MilestonesTabProps) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState("");

  const canUnlock = role === "admin" || (role === "peer_specialist" && assignedPeerId === user?.id);

  // Fetch all active milestone definitions
  const { data: definitions = [] } = useQuery({
    queryKey: ["milestone-definitions-active"],
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

  // Fetch participant's unlocked milestones with unlocked_by user info
  const { data: unlocked = [] } = useQuery({
    queryKey: ["participant-milestones", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_milestones")
        .select("*, milestone:milestone_id(name), unlocker:unlocked_by(email)")
        .eq("participant_id", participantId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch peer specialist profile name for display on unlocked milestones
  const peerUserIds = [...new Set(unlocked.map((u) => u.unlocked_by))];
  const { data: peerNames = {} } = useQuery({
    queryKey: ["peer-names", peerUserIds],
    enabled: peerUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", peerUserIds);
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        map[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Peer Specialist";
      });
      return map;
    },
  });

  const unlockedMap = new Map(unlocked.map((u) => [u.milestone_id, u]));

  // Get current peer specialist's name for notification
  const { data: currentPeerName } = useQuery({
    queryKey: ["current-peer-name", user?.id],
    enabled: !!user?.id && canUnlock,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) return [data.first_name, data.last_name].filter(Boolean).join(" ");
      // Fallback for admin
      const { data: u } = await supabase.from("users").select("email").eq("id", user!.id).single();
      return u?.email ?? "Admin";
    },
  });

  // Get participant's user_id for notification
  const { data: participantUserId } = useQuery({
    queryKey: ["participant-user-id", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("user_id")
        .eq("id", participantId)
        .single();
      return data?.user_id ?? null;
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async ({ milestoneId, milestoneName }: { milestoneId: string; milestoneName: string }) => {
      // 1. Insert participant_milestone
      const { error: insertErr } = await supabase.from("participant_milestones").insert({
        participant_id: participantId,
        milestone_id: milestoneId,
        unlocked_by: user!.id,
        note: note.trim() || null,
      });
      if (insertErr) throw insertErr;

      // 2. Recalculate card level
      await supabase.rpc("recalculate_card_level", { p_participant_id: participantId });

      // 3. Notify participant
      if (participantUserId) {
        await supabase.from("notifications").insert({
          user_id: participantUserId,
          type: "milestone_unlocked" as const,
          title: `Milestone unlocked: ${milestoneName}!`,
          body: `Your peer specialist ${currentPeerName ?? "your peer specialist"} verified this.`,
          link: "/card",
          related_id: milestoneId,
          related_type: "milestone",
        });
      }

      // Update CRPS competencies
      updateCrpsCompetencies({ action: "milestone_unlocked", peer_id: user!.id });

      return milestoneName;
    },
    onSuccess: (milestoneName) => {
      toast.success(`${milestoneName} unlocked for ${participantName}`);
      queryClient.invalidateQueries({ queryKey: ["participant-milestones", participantId] });
      queryClient.invalidateQueries({ queryKey: ["milestone-stats", participantId] });
      queryClient.invalidateQueries({ queryKey: ["participant-detail", participantId] });
      setUnlockTarget(null);
      setNote("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to unlock milestone");
    },
  });

  return (
    <div className="space-y-3">
      {definitions.map((def) => {
        const record = unlockedMap.get(def.id);
        const isUnlocked = !!record;

        return (
          <div
            key={def.id}
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              isUnlocked ? "bg-green-50 border-green-200" : "bg-card border-border"
            }`}
          >
            {isUnlocked ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${isUnlocked ? "text-green-800" : "text-foreground"}`}>
                {def.name}
              </p>

              {isUnlocked && record ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-green-700">
                    Unlocked {format(new Date(record.unlocked_at), "MMM d, yyyy")}
                    {peerNames[record.unlocked_by] && ` by ${peerNames[record.unlocked_by]}`}
                  </p>
                  {record.note && (
                    <p className="text-xs text-green-600 italic">"{record.note}"</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
              )}
            </div>

            {!isUnlocked && canUnlock && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs"
                onClick={() => setUnlockTarget({ id: def.id, name: def.name })}
              >
                Unlock
              </Button>
            )}
          </div>
        );
      })}

      {/* Unlock Modal */}
      <Dialog open={!!unlockTarget} onOpenChange={(open) => { if (!open) { setUnlockTarget(null); setNote(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock: {unlockTarget?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Add a note about this milestone (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              onClick={() => unlockTarget && unlockMutation.mutate({ milestoneId: unlockTarget.id, milestoneName: unlockTarget.name })}
              disabled={unlockMutation.isPending}
              className="w-full"
            >
              {unlockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Unlock Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MilestonesTab;
