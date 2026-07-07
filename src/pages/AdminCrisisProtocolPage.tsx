import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, Pencil, History, Eye, Save, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ProtocolRow = {
  id: string;
  content: string;
  version: number;
  is_current: boolean;
  updated_at: string;
};

const renderMarkdown = (text: string) =>
  text.split("\n").map((line, i) => {
    if (line.startsWith("### "))
      return <h3 key={i} className="text-base font-bold mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith("## "))
      return <h2 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith("# "))
      return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h2>;
    if (line.startsWith("- ") || line.startsWith("* "))
      return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
    if (line.match(/^\d+\./))
      return <li key={i} className="ml-4 text-sm list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
    if (line.trim() === "") return <br key={i} />;
    const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    return <p key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: bold }} />;
  });

const AdminCrisisProtocolPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [viewingVersion, setViewingVersion] = useState<ProtocolRow | null>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["crisis-protocol-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crisis_protocol")
        .select("*")
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProtocolRow[];
    },
  });

  const current = versions.find((v) => v.is_current) ?? versions[0] ?? null;
  const history = versions.filter((v) => !v.is_current);

  useEffect(() => {
    if (editing && current) setDraft(current.content);
  }, [editing, current]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const nextVersion = (versions[0]?.version ?? 0) + 1;

      // Unset current on all existing rows
      const { error: e1 } = await supabase
        .from("crisis_protocol")
        .update({ is_current: false })
        .eq("is_current", true);
      if (e1) throw e1;

      // Insert new current version
      const { data: inserted, error: e2 } = await supabase
        .from("crisis_protocol")
        .insert({ content, version: nextVersion, is_current: true })
        .select("id, version")
        .single();
      if (e2) throw e2;

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "save_crisis_protocol",
        target_type: "crisis_protocol",
        target_id: inserted.id,
        metadata: { version: inserted.version } as any,
      } as any);

      return inserted.version;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["crisis-protocol-versions"] });
      setEditing(false);
      toast.success(`Saved. Version ${v} is now live.`);
    },
    onError: () => toast.error("Failed to save protocol"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading protocol…</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Crisis Protocol
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quick-reference peers see when logging a crisis note. Editing publishes a new version;
            past versions are preserved.
          </p>
        </div>
        {!editing && current && (
          <Button
            onClick={() => setEditing(true)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Pencil className="h-4 w-4 mr-1" /> Edit Protocol
          </Button>
        )}
      </div>

      {!current && !editing && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No crisis protocol has been created yet.</p>
            <Button
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Create Protocol
            </Button>
          </CardContent>
        </Card>
      )}

      {editing ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Editing — will save as version {(versions[0]?.version ?? 0) + 1}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(draft)}
                disabled={!draft.trim() || saveMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Saving…" : "Save New Version"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="# Crisis Protocol&#10;&#10;## Step 1&#10;..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Supports simple markdown: <code># H1</code>, <code>## H2</code>, <code>- bullets</code>,
                  <code>**bold**</code>, <code>1. numbered</code>.
                </p>
              </TabsContent>
              <TabsContent value="preview" className="mt-3">
                <div className="border border-border rounded-md p-4 bg-muted/30 min-h-[300px]">
                  {draft.trim() ? renderMarkdown(draft) : (
                    <p className="text-sm text-muted-foreground italic">Nothing to preview yet.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        current && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Current Protocol
                <Badge className="bg-primary/10 text-primary border-0">v{current.version}</Badge>
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Updated {format(new Date(current.updated_at), "MMM d, yyyy")}
              </span>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">{renderMarkdown(current.content)}</div>
            </CardContent>
          </Card>
        )
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Version History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-card"
              >
                <div>
                  <p className="text-sm font-medium">Version {v.version}</p>
                  <p className="text-xs text-muted-foreground">
                    Saved {format(new Date(v.updated_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewingVersion(v)}>
                  <Eye className="h-4 w-4 mr-1" /> View
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!viewingVersion} onOpenChange={(open) => !open && setViewingVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Version {viewingVersion?.version}
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (read-only)
              </span>
            </DialogTitle>
          </DialogHeader>
          {viewingVersion && (
            <div className="prose prose-sm max-w-none">
              {renderMarkdown(viewingVersion.content)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCrisisProtocolPage;
