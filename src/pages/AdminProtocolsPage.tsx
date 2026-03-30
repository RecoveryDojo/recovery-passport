import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileText, Pencil, ChevronDown, History, Eye, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const AdminProtocolsPage = () => {
  const qc = useQueryClient();
  const [editingProtocol, setEditingProtocol] = useState(false);
  const [protocolDraft, setProtocolDraft] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<{ content: string; version: number } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; note_type: string; guiding_prompts: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: currentProtocol } = useQuery({
    queryKey: ["crisis-protocol-current"],
    queryFn: async () => {
      const { data } = await supabase.from("crisis_protocol").select("*").eq("is_current", true).maybeSingle();
      return data;
    },
  });

  const { data: allVersions } = useQuery({
    queryKey: ["crisis-protocol-versions"],
    queryFn: async () => {
      const { data } = await supabase.from("crisis_protocol").select("*").order("version", { ascending: false });
      return data ?? [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["note-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("note_templates").select("*").order("note_type");
      return data ?? [];
    },
  });

  const saveProtocol = useMutation({
    mutationFn: async (content: string) => {
      await supabase.from("crisis_protocol").update({ is_current: false }).eq("is_current", true);
      const newVersion = (allVersions?.[0]?.version ?? 0) + 1;
      const { error } = await supabase.from("crisis_protocol").insert({ content, version: newVersion, is_current: true });
      if (error) throw error;
      return newVersion;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["crisis-protocol-current"] });
      qc.invalidateQueries({ queryKey: ["crisis-protocol-versions"] });
      setEditingProtocol(false);
      toast({ title: `Protocol updated. Version ${v} is now live.` });
    },
    onError: () => toast({ title: "Error saving protocol", variant: "destructive" }),
  });

  const saveTemplate = useMutation({
    mutationFn: async ({ id, guiding_prompts }: { id: string; guiding_prompts: string }) => {
      const { error } = await supabase.from("note_templates").update({ guiding_prompts, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note-templates"] });
      setEditingTemplate(null);
      toast({ title: "Template updated" });
    },
    onError: () => toast({ title: "Error saving template", variant: "destructive" }),
  });

  const typeLabel = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const renderMarkdown = (text: string) => {
    // Simple markdown: bold, headers, bullets
    return text
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h2>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
        if (line.match(/^\d+\./)) return <li key={i} className="ml-4 text-sm list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
        if (line.trim() === "") return <br key={i} />;
        const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return <p key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: bold }} />;
      });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-primary">Protocols & Templates</h1>

      {/* Section 1: Crisis Protocol */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" /> Crisis De-escalation Protocol
              {currentProtocol && <Badge variant="secondary" className="text-xs">v{currentProtocol.version}</Badge>}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setProtocolDraft(currentProtocol?.content ?? ""); setEditingProtocol(true); setPreviewMode(false); }}>
              <Pencil className="h-3 w-3 mr-1" /> Edit Protocol
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentProtocol ? (
            <div className="bg-muted/30 rounded-lg p-4">{renderMarkdown(currentProtocol.content)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No protocol set.</p>
          )}

          {/* Version History */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                <History className="h-3 w-3 mr-1" /> Version History
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {allVersions?.map(v => (
                <div key={v.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50">
                  <div>
                    <span className="font-medium">Version {v.version}</span>
                    <span className="text-muted-foreground ml-2">{format(new Date(v.updated_at), "MMM d, yyyy")}</span>
                    {v.is_current && <Badge className="ml-2 text-xs">Current</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setViewingVersion({ content: v.content, version: v.version })}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Section 2: Note Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Note Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates?.map(t => (
            <div key={t.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="capitalize">{typeLabel(t.note_type)}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setEditingTemplate({ id: t.id, note_type: t.note_type, guiding_prompts: t.guiding_prompts })}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.guiding_prompts}</p>
              <p className="text-xs text-muted-foreground">Updated {format(new Date(t.updated_at), "MMM d, yyyy")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Protocol Editor Dialog */}
      <Dialog open={editingProtocol} onOpenChange={setEditingProtocol}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Crisis Protocol</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Tabs value={previewMode ? "preview" : "edit"} onValueChange={v => setPreviewMode(v === "preview")}>
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea value={protocolDraft} onChange={e => setProtocolDraft(e.target.value)} rows={16} className="font-mono text-sm" />
              </TabsContent>
              <TabsContent value="preview">
                <div className="bg-muted/30 rounded-lg p-4 min-h-[200px]">{renderMarkdown(protocolDraft)}</div>
              </TabsContent>
            </Tabs>
            <Button onClick={() => saveProtocol.mutate(protocolDraft)} disabled={!protocolDraft.trim() || saveProtocol.isPending}>
              <Save className="h-4 w-4 mr-1" /> {saveProtocol.isPending ? "Saving…" : "Save New Version"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Past Version */}
      <Dialog open={!!viewingVersion} onOpenChange={(o) => !o && setViewingVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version {viewingVersion?.version}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 rounded-lg p-4">{viewingVersion && renderMarkdown(viewingVersion.content)}</div>
        </DialogContent>
      </Dialog>

      {/* Template Editor */}
      <Dialog open={!!editingTemplate} onOpenChange={(o) => !o && setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingTemplate ? typeLabel(editingTemplate.note_type) : ""} Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editingTemplate?.guiding_prompts ?? ""}
              onChange={e => setEditingTemplate(prev => prev ? { ...prev, guiding_prompts: e.target.value } : null)}
              rows={6}
            />
            <Button
              className="w-full"
              disabled={!editingTemplate?.guiding_prompts.trim()}
              onClick={() => editingTemplate && saveTemplate.mutate(editingTemplate)}
            >
              {saveTemplate.isPending ? "Saving…" : "Save Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProtocolsPage;
