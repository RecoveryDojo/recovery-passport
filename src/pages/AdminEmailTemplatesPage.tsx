import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Save, RotateCcw, Eye } from "lucide-react";

type EmailTemplate = {
  id: string;
  event_key: string;
  display_name: string;
  description: string | null;
  subject: string;
  body_markdown: string;
  enabled: boolean;
};

const PLACEHOLDERS = ["{{first_name}}", "{{role}}", "{{milestone_name}}", "{{level}}", "{{app_url}}"];

const SAMPLE: Record<string, string> = {
  first_name: "Will",
  role: "Admin",
  milestone_name: "30 Days Engaged",
  level: "Veteran",
  app_url: "https://www.myrecoverypassport.com",
};

const render = (text: string) =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, key) => SAMPLE[key] ?? `{{${key}}}`);

const TemplateCard = ({
  template,
  onSave,
  saving,
}: {
  template: EmailTemplate;
  onSave: (t: Partial<EmailTemplate> & { id: string }) => void;
  saving: boolean;
}) => {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body_markdown);
  const [preview, setPreview] = useState(false);

  const dirty = subject !== template.subject || body !== template.body_markdown;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              {template.display_name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={template.enabled ? "default" : "secondary"}>
              {template.enabled ? "On" : "Off"}
            </Badge>
            <Switch
              checked={template.enabled}
              disabled={saving}
              onCheckedChange={(v) => onSave({ id: template.id, enabled: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Body</label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPreview((p) => !p)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>
          {preview ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-foreground">
              <p className="font-semibold mb-2">{render(subject)}</p>
              {render(body)}
            </div>
          ) : (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="font-mono text-xs"
              disabled={saving}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setBody((b) => `${b}${p}`)}
              className="text-[11px] rounded bg-accent/10 text-accent px-2 py-0.5 hover:bg-accent/20"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={() => onSave({ id: template.id, subject, body_markdown: body })}
          >
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setSubject(template.subject);
              setBody(template.body_markdown);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminEmailTemplatesPage = () => {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase.from("email_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Email Templates</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Wording for the automatic emails the app sends. Turn any event off to stop that email
        without changing anything else.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              saving={save.isPending}
              onSave={(p) => save.mutate(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEmailTemplatesPage;
