import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, EyeOff, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type MiPrompt = Tables<"mi_prompts">;
type SituationTag = MiPrompt["situation_tag"];

const TAGS: { value: SituationTag; label: string }[] = [
  { value: "first_checkin", label: "First Check-In" },
  { value: "ambivalence", label: "Ambivalence" },
  { value: "barriers", label: "Barriers" },
  { value: "motivation", label: "Motivation" },
  { value: "planning", label: "Planning" },
  { value: "crisis", label: "Crisis" },
];

const AdminMiPromptsPage = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<MiPrompt> | null>(null);
  const [tab, setTab] = useState<string>("first_checkin");

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["mi-prompts-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mi_prompts").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as MiPrompt[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (prompt: Partial<MiPrompt>) => {
      if (prompt.id) {
        const { error } = await supabase.from("mi_prompts").update({
          text: prompt.text!,
          situation_tag: prompt.situation_tag!,
          explanation: prompt.explanation ?? null,
          is_active: prompt.is_active ?? true,
        }).eq("id", prompt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mi_prompts").insert({
          text: prompt.text!,
          situation_tag: prompt.situation_tag!,
          explanation: prompt.explanation ?? null,
          is_active: prompt.is_active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mi-prompts-admin"] });
      setEditing(null);
      toast({ title: "Prompt saved" });
    },
    onError: () => toast({ title: "Error saving prompt", variant: "destructive" }),
  });

  const deactivate = async (id: string) => {
    await supabase.from("mi_prompts").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["mi-prompts-admin"] });
    toast({ title: "Prompt deactivated" });
  };

  const grouped = TAGS.reduce((acc, t) => {
    acc[t.value] = (prompts ?? []).filter(p => p.situation_tag === t.value);
    return acc;
  }, {} as Record<string, MiPrompt[]>);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> MI Prompt Library
        </h1>
        <Button size="sm" onClick={() => setEditing({ situation_tag: tab as SituationTag, is_active: true, text: "", explanation: "" })}>
          <Plus className="h-4 w-4 mr-1" /> Add Prompt
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TAGS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label} ({grouped[t.value]?.length ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {TAGS.map(t => (
          <TabsContent key={t.value} value={t.value} className="space-y-3 mt-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {grouped[t.value]?.length === 0 && <p className="text-sm text-muted-foreground">No prompts in this category.</p>}

            {grouped[t.value]?.map(p => (
              <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{p.text}</p>
                    <Badge variant={p.is_active ? "default" : "secondary"} className="shrink-0 text-xs">
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {p.explanation && <p className="text-xs text-muted-foreground italic">{p.explanation}</p>}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Used {p.usage_count}×</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {p.helpful_count}</span>
                      <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> {p.not_relevant_count}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      {p.is_active && (
                        <Button size="sm" variant="ghost" onClick={() => deactivate(p.id)}>
                          <EyeOff className="h-3 w-3 mr-1" /> Deactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <p className="text-xs text-muted-foreground italic pt-2 border-t border-border">
              Prompts with the lowest helpful count / highest not-relevant count may be candidates for retirement.
            </p>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Prompt" : "Add New Prompt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Prompt Text</Label>
              <Textarea value={editing?.text ?? ""} onChange={e => setEditing(prev => prev ? { ...prev, text: e.target.value } : null)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Situation Tag</Label>
              <Select value={editing?.situation_tag ?? ""} onValueChange={v => setEditing(prev => prev ? { ...prev, situation_tag: v as SituationTag } : null)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAGS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Explanation (optional)</Label>
              <Textarea value={editing?.explanation ?? ""} onChange={e => setEditing(prev => prev ? { ...prev, explanation: e.target.value } : null)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing?.is_active ?? true} onCheckedChange={v => setEditing(prev => prev ? { ...prev, is_active: v } : null)} />
              <Label>Active</Label>
            </div>
            <Button className="w-full" disabled={!editing?.text?.trim()} onClick={() => editing && saveMutation.mutate(editing)}>
              {saveMutation.isPending ? "Saving…" : "Save Prompt"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMiPromptsPage;
