import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Save, RotateCcw } from "lucide-react";

type NoteTemplate = {
  id: string;
  note_type: string;
  guiding_prompts: string;
  updated_at?: string;
};

const NOTE_TYPE_ORDER = ["general", "crisis", "referral", "milestone", "transition"];

const NOTE_TYPE_META: Record<string, { label: string; tone: string; blurb: string }> = {
  general: {
    label: "General",
    tone: "bg-muted text-muted-foreground",
    blurb: "Default note peers write during routine check-ins.",
  },
  crisis: {
    label: "Crisis",
    tone: "bg-red-100 text-red-700",
    blurb: "Written when a participant is in acute crisis.",
  },
  referral: {
    label: "Referral",
    tone: "bg-blue-100 text-blue-700",
    blurb: "Documents a referral to a community partner or program.",
  },
  milestone: {
    label: "Milestone",
    tone: "bg-amber-100 text-amber-700",
    blurb: "Written when a participant earns a milestone.",
  },
  transition: {
    label: "Transition",
    tone: "bg-purple-100 text-purple-700",
    blurb: "Documents a participant's transition or discharge plan.",
  },
};

const TemplateEditor = ({
  template,
  onSave,
  saving,
}: {
  template: NoteTemplate;
  onSave: (id: string, next: string) => void;
  saving: boolean;
}) => {
  const [draft, setDraft] = useState(template.guiding_prompts);
  const dirty = draft.trim() !== (template.guiding_prompts ?? "").trim();

  useEffect(() => {
    setDraft(template.guiding_prompts);
  }, [template.id, template.guiding_prompts]);

  const meta = NOTE_TYPE_META[template.note_type] ?? {
    label: template.note_type,
    tone: "bg-muted text-muted-foreground",
    blurb: "",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge className={`${meta.tone} border-0`}>{meta.label}</Badge>
            <CardTitle className="text-base">{meta.label} note</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => setDraft(template.guiding_prompts)}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
            <Button
              size="sm"
              disabled={!dirty || !draft.trim() || saving}
              onClick={() => onSave(template.id, draft.trim())}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{meta.blurb}</p>
      </CardHeader>
      <CardContent>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Guiding prompt shown to peers
        </label>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="mt-2 text-sm"
        />
      </CardContent>
    </Card>
  );
};

const AdminNoteTemplatesPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-note-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("note_templates").select("*");
      if (error) throw error;
      return (data ?? []) as NoteTemplate[];
    },
  });

  const orderedTemplates = [...templates].sort(
    (a, b) => NOTE_TYPE_ORDER.indexOf(a.note_type) - NOTE_TYPE_ORDER.indexOf(b.note_type),
  );

  const saveMutation = useMutation({
    mutationFn: async ({ id, next, note_type }: { id: string; next: string; note_type: string }) => {
      const { error } = await supabase
        .from("note_templates")
        .update({ guiding_prompts: next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "edit_note_template",
        target_type: "note_templates",
        target_id: id,
        metadata: { note_type } as any,
      } as any);
    },
    onMutate: ({ id }) => setSavingId(id),
    onSettled: () => setSavingId(null),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-note-templates"] });
      toast.success(`${NOTE_TYPE_META[vars.note_type]?.label ?? vars.note_type} template saved`);
    },
    onError: () => toast.error("Failed to save template"),
  });

  const handleSave = (id: string, next: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    saveMutation.mutate({ id, next, note_type: tpl.note_type });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading note templates…</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Note Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit the guiding prompt peers see for each note type. Changes apply the next time a peer
          writes that kind of note. Note types themselves are fixed and cannot be added or removed.
        </p>
      </div>

      <div className="space-y-4">
        {orderedTemplates.map((t) => (
          <TemplateEditor
            key={t.id}
            template={t}
            onSave={handleSave}
            saving={savingId === t.id}
          />
        ))}
      </div>
    </div>
  );
};

export default AdminNoteTemplatesPage;
