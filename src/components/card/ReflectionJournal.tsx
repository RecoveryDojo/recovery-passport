/**
 * Reflection Journal — private participant writing space.
 *
 * Inserts a `progress_notes` row authored by the participant (Phase 2C RLS).
 * Stored with `note_type = 'general'` and a "Journal:" prefix so the peer
 * UI can distinguish reflective entries from peer-authored notes.
 *
 * Lists the last 3 entries from `useParticipantClinicalSummary().recentNotes`,
 * filtering to participant-authored ones.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";

interface Props {
  participantId: string;
}

const ReflectionJournal = ({ participantId }: Props) => {
  const { user } = useAuth();
  const { data } = useParticipantClinicalSummary(participantId);
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");

  const myEntries = (data?.recentNotes ?? [])
    .filter((n) => n.author_id === user?.id && n.content.startsWith("Journal:"))
    .slice(0, 3);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) throw new Error("Empty");
      const { error } = await supabase.from("progress_notes").insert({
        participant_id: participantId,
        author_id: user.id,
        note_type: "general",
        content: `Journal: ${text.trim()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved to your journal");
      setText("");
      setComposing(false);
      queryClient.invalidateQueries({ queryKey: ["participant-clinical-summary", participantId] });
    },
    onError: () => toast.error("Could not save. Try again."),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-accent" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Reflection Journal</p>
          <p className="text-xs text-muted-foreground">A private space, just for you.</p>
        </div>
      </div>

      {/* Recent entries */}
      {myEntries.length > 0 && (
        <ul className="space-y-2">
          {myEntries.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
            >
              <p className="line-clamp-2">{e.content.replace(/^Journal:\s*/, "")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {format(new Date(e.created_at), "MMM d, h:mm a")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!composing ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setComposing(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          New entry
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind today?"
            rows={4}
            className="text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setComposing(false);
                setText("");
              }}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={() => saveMutation.mutate()}
              disabled={!text.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReflectionJournal;
