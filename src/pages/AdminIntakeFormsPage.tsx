import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, FileSignature, Save, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Database } from "@/integrations/supabase/types";

type IntakeFormType = Database["public"]["Enums"]["intake_form_type"];

const FORM_TYPES: { type: IntakeFormType; label: string; description: string }[] = [
  { type: "house_rules", label: "House Rules", description: "Read-aloud checklist for the peer to verbalize with the participant." },
  { type: "disclosure_consent", label: "Consent to Disclose", description: "Consent for disclosure to authorized contacts." },
  { type: "belongings_consent", label: "Personal Belongings Consent", description: "Consent to search / store personal belongings." },
  { type: "services_consent", label: "Consent for Services", description: "Peer support and assessments — requires two initials." },
  { type: "liability_waiver", label: "Liability Waiver", description: "Program participation waiver of liability." },
  { type: "non_tenancy", label: "Non-Tenancy Acknowledgement", description: "Acknowledgement that program stay is not a tenancy." },
  { type: "contribution_agreement", label: "Contribution Agreement", description: "Participant financial contribution terms." },
];

const AdminIntakeFormsPage = () => {
  const queryClient = useQueryClient();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<IntakeFormType | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const { data: templates = [] } = useQuery({
    queryKey: ["intake-form-templates", selectedProgramId, selectedForm],
    enabled: !!selectedProgramId && !!selectedForm,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_form_templates")
        .select("*")
        .eq("program_id", selectedProgramId!)
        .eq("form_type", selectedForm!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const current = templates[0] ?? null;
  const pastVersions = templates.slice(1);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProgramId || !selectedForm) return;
      const newVersion = current ? current.version + 1 : 1;

      // Flip old current
      if (current) {
        const { error: updErr } = await supabase
          .from("intake_form_templates")
          .update({ is_current: false })
          .eq("program_id", selectedProgramId)
          .eq("form_type", selectedForm)
          .eq("is_current", true);
        if (updErr) throw updErr;
      }

      const { error } = await supabase.from("intake_form_templates").insert({
        program_id: selectedProgramId,
        form_type: selectedForm,
        content: draftContent,
        version: newVersion,
        is_current: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Form template published");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["intake-form-templates", selectedProgramId, selectedForm] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingPrograms) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Step 1: pick a program
  if (!selectedProgramId) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto space-y-4">
        <Link
          to="/admin/content"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Content
        </Link>
        <h1 className="text-xl font-bold text-foreground">Intake Forms</h1>
        <p className="text-sm text-muted-foreground">
          Manage the seven signed intake forms per program.
        </p>
        <div className="space-y-2">
          {programs.map((prog) => (
            <button
              key={prog.id}
              onClick={() => setSelectedProgramId(prog.id)}
              className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-accent/50 transition-colors flex items-center gap-3"
            >
              <FileSignature className="h-5 w-5 text-accent shrink-0" />
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

  // Step 2: pick a form type
  if (!selectedForm) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => setSelectedProgramId(null)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All Programs
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {selectedProgram?.name} — Intake Forms
        </h1>
        <div className="space-y-2">
          {FORM_TYPES.map((f) => (
            <button
              key={f.type}
              onClick={() => setSelectedForm(f.type)}
              className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-accent/50 transition-colors"
            >
              <p className="font-semibold text-foreground">{f.label}</p>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const formMeta = FORM_TYPES.find((f) => f.type === selectedForm)!;

  return (
    <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => {
          setSelectedForm(null);
          setEditing(false);
        }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All Forms
      </button>

      <h1 className="text-xl font-bold text-foreground">
        {selectedProgram?.name} — {formMeta.label}
      </h1>
      <p className="text-sm text-muted-foreground">{formMeta.description}</p>

      {!editing ? (
        <>
          {current ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Version {current.version} · Published{" "}
                {format(new Date(current.created_at), "MMM d, yyyy")}
              </p>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {current.content}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No form published yet.
              </p>
            </div>
          )}

          <Button
            onClick={() => {
              setDraftContent(current?.content ?? "");
              setEditing(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {current ? "Edit Form" : "Create Form"}
          </Button>

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
        <div className="space-y-3">
          <Textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={18}
            placeholder="Enter the form text…"
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

export default AdminIntakeFormsPage;
