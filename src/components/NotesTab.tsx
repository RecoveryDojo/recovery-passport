import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, ChevronDown, AlertTriangle, FileText } from "lucide-react";
import { updateCrpsCompetencies } from "@/lib/crps-updater";
import type { Database } from "@/integrations/supabase/types";

type NoteType = Database["public"]["Enums"]["note_type"];

const NOTE_TYPE_STYLES: Record<NoteType, { label: string; color: string }> = {
  general: { label: "General", color: "bg-muted text-muted-foreground" },
  crisis: { label: "Crisis", color: "bg-red-100 text-red-700" },
  referral: { label: "Referral", color: "bg-blue-100 text-blue-700" },
  milestone: { label: "Milestone", color: "bg-primary/10 text-primary" },
  transition: { label: "Transition", color: "bg-amber-100 text-amber-700" },
};

interface NotesTabProps {
  participantId: string;
  participantName: string;
  viewerRole?: "peer" | "admin";
}

const NotesTab = ({ participantId, participantName, viewerRole = "peer" }: NotesTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noteType, setNoteType] = useState<NoteType | "">("");
  const [content, setContent] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Notes list
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["progress-notes", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_notes")
        .select("*")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Note template for guiding prompts
  const { data: template } = useQuery({
    queryKey: ["note-template", noteType],
    enabled: !!noteType,
    queryFn: async () => {
      const { data } = await supabase
        .from("note_templates")
        .select("guiding_prompts")
        .eq("note_type", noteType as NoteType)
        .maybeSingle();
      return data;
    },
  });

  // Crisis protocol
  const { data: crisisProtocol } = useQuery({
    queryKey: ["crisis-protocol"],
    enabled: noteType === "crisis",
    queryFn: async () => {
      const { data } = await supabase
        .from("crisis_protocol")
        .select("content")
        .eq("is_current", true)
        .maybeSingle();
      return data;
    },
  });

  // Peer specialist profile for name
  const { data: peerProfile } = useQuery({
    queryKey: ["my-peer-profile-notes", user?.id],
    enabled: !!user && viewerRole === "peer",
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!noteType || !content.trim() || !user) throw new Error("Missing fields");

      const { data, error } = await supabase
        .from("progress_notes")
        .insert({
          participant_id: participantId,
          author_id: user.id,
          note_type: noteType as NoteType,
          content: content.trim(),
        })
        .select("id")
        .single();
      if (error) throw error;

      // Audit: submit_note
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "submit_note",
        target_type: "progress_notes",
        target_id: data.id,
        metadata: { note_type: noteType, participant_id: participantId },
      });

      // Crisis-specific actions
      if (noteType === "crisis") {
        // Log CRPS hours
        await supabase.from("crps_hours_log").insert({
          peer_specialist_id: user.id,
          category: "direct_peer_services" as any,
          hours: 0.5,
          source_type: "crisis" as any,
          source_id: data.id,
        });

        // Notify admins
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .eq("role", "admin");

        const peerName = peerProfile
          ? `${peerProfile.first_name} ${peerProfile.last_name}`.trim()
          : "A peer specialist";

        if (admins?.length) {
          await supabase.from("notifications").insert(
            admins.map((a) => ({
              user_id: a.id,
              type: "general" as any,
              title: "⚠️ Crisis note flagged for review",
              body: `${peerName} logged a crisis interaction for ${participantName}.`,
              link: `/admin/peers/review`,
            }))
          );
        }
      }

      // Update CRPS competencies
      updateCrpsCompetencies({
        action: noteType === "crisis" ? "checkin" : noteType === "referral" ? "referral" : "progress_note",
        peer_id: user.id,
        note_type: noteType,
        participant_id: participantId,
      });

      return noteType;
    },
    onSuccess: (type) => {
      queryClient.invalidateQueries({ queryKey: ["progress-notes", participantId] });
      setDialogOpen(false);
      setNoteType("");
      setContent("");

      if (type === "crisis") {
        toast.info("This note has been flagged for supervisor review. Remember to complete your self-care check.", { duration: 6000 });
      } else {
        toast.success("Note saved");
      }
    },
    onError: () => toast.error("Failed to save note"),
  });

  // Sort: crisis notes first, then chronological
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.note_type === "crisis" && b.note_type !== "crisis") return -1;
    if (b.note_type === "crisis" && a.note_type !== "crisis") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const toggleExpand = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading notes…</div>;
  }

  return (
    <div className="space-y-4">
      {/* New Note button (peer only) */}
      {viewerRole === "peer" && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
              <Plus className="h-4 w-4 mr-1" /> New Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Progress Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Type selector */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Note Type</label>
                <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="crisis">Crisis</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="transition">Transition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Guiding prompt */}
              {template?.guiding_prompts && (
                <div className="bg-muted/50 rounded-lg p-3 border border-border">
                  <p className="text-sm text-muted-foreground italic whitespace-pre-line">
                    {template.guiding_prompts}
                  </p>
                </div>
              )}

              {/* Crisis protocol */}
              {noteType === "crisis" && crisisProtocol?.content && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800 w-full">
                    <AlertTriangle className="h-4 w-4" />
                    📋 Crisis Protocol Quick Reference
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800 whitespace-pre-line">{crisisProtocol.content}</p>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Content */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Your note:</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note here…"
                  rows={6}
                />
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!noteType || !content.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? "Saving…" : "Save Note"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Notes list */}
      {sortedNotes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No progress notes yet.</p>
        </div>
      ) : (
        sortedNotes.map((note) => {
          const style = NOTE_TYPE_STYLES[note.note_type as NoteType] ?? NOTE_TYPE_STYLES.general;
          const isExpanded = expandedNotes.has(note.id);
          const isTruncated = note.content.length > 200;

          return (
            <div
              key={note.id}
              className={`bg-card border rounded-xl p-4 space-y-2 ${
                note.note_type === "crisis" ? "border-red-300 bg-red-50/30" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${style.color} border-0 text-xs`}>{style.label}</Badge>
                {note.note_type === "crisis" && (
                  <Badge className="bg-red-600 text-white border-0 text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" /> Crisis
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(note.created_at), "MMM d, yyyy · h:mm a")}
                </span>
              </div>

              <p className="text-sm text-foreground whitespace-pre-line">
                {isTruncated && !isExpanded ? note.content.slice(0, 200) + "…" : note.content}
              </p>
              {isTruncated && (
                <button
                  onClick={() => toggleExpand(note.id)}
                  className="text-xs text-primary hover:underline"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default NotesTab;
