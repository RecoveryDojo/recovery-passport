import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, FileText, ChevronDown, ChevronUp, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const AdminAgreementsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // All programs
  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Agreements for selected program (all versions, newest first)
  const { data: agreements = [] } = useQuery({
    queryKey: ["program-agreements", selectedProgramId],
    enabled: !!selectedProgramId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_agreements")
        .select("*")
        .eq("program_id", selectedProgramId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentAgreement = agreements[0] ?? null;
  const pastVersions = agreements.slice(1);

  // Participants in this program (for notifications)
  const publishMutation = useMutation({
    mutationFn: async () => {
      const newVersion = currentAgreement ? currentAgreement.version + 1 : 1;

      // Insert new agreement version
      const { error: insertErr } = await supabase
        .from("program_agreements")
        .insert({
          program_id: selectedProgramId!,
          content: draftContent,
          version: newVersion,
        });
      if (insertErr) throw insertErr;

      // Notify all participants in this program
      const { data: participants } = await supabase
        .from("participant_profiles")
        .select("user_id")
        .eq("current_program_id", selectedProgramId!);

      if (participants && participants.length > 0) {
        const notifications = participants.map((p) => ({
          user_id: p.user_id,
          type: "agreement_updated" as const,
          title: "Program guidelines updated",
          body: "Updated program guidelines are available. Please review.",
          link: "/agreements",
        }));
        await supabase.from("notifications").insert(notifications);
      }
    },
    onSuccess: () => {
      toast.success("Agreement published");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["program-agreements", selectedProgramId] });
    },
    onError: () => toast.error("Failed to publish agreement"),
  });

  if (loadingPrograms) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Program list view
  if (!selectedProgramId) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto space-y-4">
        <Link
          to="/admin/content"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Content
        </Link>
        <h1 className="text-xl font-bold text-foreground">Program Agreements</h1>
        <div className="space-y-2">
          {programs.map((prog) => (
            <button
              key={prog.id}
              onClick={() => setSelectedProgramId(prog.id)}
              className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-accent/50 transition-colors flex items-center gap-3"
            >
              <FileText className="h-5 w-5 text-accent shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{prog.name}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {prog.type.replace(/_/g, " ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  return (
    <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => {
          setSelectedProgramId(null);
          setEditing(false);
        }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All Programs
      </button>

      <h1 className="text-xl font-bold text-foreground">
        {selectedProgram?.name} — Agreement
      </h1>

      {/* Current version or empty state */}
      {!editing ? (
        <>
          {currentAgreement ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Version {currentAgreement.version} · Published{" "}
                  {format(new Date(currentAgreement.created_at), "MMM d, yyyy")}
                </p>
              </div>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {currentAgreement.content}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No agreement published yet for this program.
              </p>
            </div>
          )}

          <Button
            onClick={() => {
              setDraftContent(currentAgreement?.content ?? "");
              setEditing(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {currentAgreement ? "Edit Agreement" : "Create Agreement"}
          </Button>

          {/* Version history */}
          {pastVersions.length > 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Version History ({pastVersions.length} previous)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {pastVersions.map((ver) => (
                  <div
                    key={ver.id}
                    className="bg-muted/50 border border-border rounded-lg p-3"
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      Version {ver.version} · {format(new Date(ver.created_at), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-foreground/70 line-clamp-3 whitespace-pre-wrap">
                      {ver.content}
                    </p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      ) : (
        /* Edit mode */
        <div className="space-y-3">
          <Textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={16}
            placeholder="Enter the program agreement text…"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={!draftContent.trim() || publishMutation.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Save className="h-4 w-4 mr-1" />
              {publishMutation.isPending ? "Publishing…" : "Publish New Version"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgreementsPage;
