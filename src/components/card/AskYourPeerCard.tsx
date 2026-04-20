/**
 * Ask Your Peer — quick conversation starter.
 *
 * Allows the participant to drop a short note for their assigned peer.
 * Inserts a `progress_notes` row authored by the participant (allowed by
 * Phase 2C RLS) with `note_type = 'general'` and a "Q:" prefix so the peer
 * recognizes it as a participant question.
 *
 * Reads `assignedPeer` from `useParticipantClinicalSummary` so we never
 * fire a separate query.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";
import { emitEvent } from "@/lib/events";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";

interface Props {
  participantId: string;
}

const AskYourPeerCard = ({ participantId }: Props) => {
  const { user } = useAuth();
  const { data } = useParticipantClinicalSummary(participantId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const peer = data?.assignedPeer ?? null;
  const peerName = peer ? `${peer.first_name} ${peer.last_name}`.trim() : null;
  const peerInitials = peer
    ? (peer.first_name?.[0] ?? "") + (peer.last_name?.[0] ?? "")
    : "?";

  const askMutation = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) throw new Error("Empty");
      const { data: noteRow, error } = await supabase
        .from("progress_notes")
        .insert({
          participant_id: participantId,
          author_id: user.id,
          note_type: "general",
          content: `Q: ${text.trim()}`,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Notify the peer (audit + notification through emitEvent)
      await emitEvent("note.created", {
        target_type: "progress_note",
        target_id: noteRow.id,
        metadata: { source: "ask_your_peer", participantId },
        recipients: peer
          ? [
              {
                user_id: peer.user_id,
                type: "general",
                title: "New question from your participant",
                body: text.trim().slice(0, 120),
                link: `/caseload/${participantId}`,
              },
            ]
          : [],
      });
    },
    onSuccess: () => {
      toast.success("Sent to your peer");
      setText("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["participant-clinical-summary", participantId] });
    },
    onError: () => toast.error("Could not send. Try again."),
  });

  if (!peer) {
    // Hide entirely until a peer is assigned — Stage-3 only feature.
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {peer.photo_url ? <AvatarImage src={peer.photo_url} alt="" /> : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {peerInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Ask {peer.first_name}</p>
          <p className="text-xs text-muted-foreground">
            Drop a quick question — they'll see it on their next caseload check.
          </p>
        </div>
        <MessageCircleQuestion className="h-5 w-5 text-primary shrink-0" aria-hidden />
      </div>

      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          Write a question
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What would you like to ask ${peerName}?`}
            rows={3}
            className="text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setText("");
              }}
              disabled={askMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={() => askMutation.mutate()}
              disabled={!text.trim() || askMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              {askMutation.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AskYourPeerCard;
