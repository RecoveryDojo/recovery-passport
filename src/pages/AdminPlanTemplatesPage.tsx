import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Copy, ArrowUp, ArrowDown, Eye, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Constants } from "@/integrations/supabase/types";

const PROGRAM_TYPES = Constants.public.Enums.template_program_type;
const PHASE_MAP: Record<string, string> = { thirty_day: "30 Day", sixty_day: "60 Day", ninety_day: "90 Day", six_month: "6 Month" };
const PHASES = Constants.public.Enums.plan_phase;

const AdminPlanTemplatesPage = () => {
  const qc = useQueryClient();
  const [programType, setProgramType] = useState("respite_house");
  const [phase, setPhase] = useState("thirty_day");
  const [editingStep, setEditingStep] = useState<any>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [dupTarget, setDupTarget] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [simScores, setSimScores] = useState<Record<string, number>>({});

  const { data: domains } = useQuery({
    queryKey: ["assessment-domains"],
    queryFn: async () => {
      const { data } = await supabase.from("assessment_domains").select("id, name").order("sort_order");
      return data ?? [];
    },
  });

  const { data: template } = useQuery({
    queryKey: ["plan-template", programType, phase],
    queryFn: async () => {
      const { data } = await supabase.from("plan_templates").select("*")
        .eq("program_type", programType as any).eq("phase", phase as any).eq("is_current", true).maybeSingle();
      return data;
    },
  });

  const { data: steps, refetch: refetchSteps } = useQuery({
    queryKey: ["plan-template-steps", template?.id],
    queryFn: async () => {
      if (!template) return [];
      const { data } = await supabase.from("plan_template_steps").select("*").eq("template_id", template.id).order("sort_order");
      return data ?? [];
    },
    enabled: !!template,
  });

  const domainMap = new Map(domains?.map(d => [d.id, d.name]) ?? []);

  const saveStep = useMutation({
    mutationFn: async (step: any) => {
      if (step.id) {
        const { error } = await supabase.from("plan_template_steps").update({
          description: step.description, is_default: step.is_default,
          domain_tag: step.is_default ? null : step.domain_tag, sort_order: step.sort_order,
        }).eq("id", step.id);
        if (error) throw error;
      } else {
        if (!template) throw new Error("No template");
        const { error } = await supabase.from("plan_template_steps").insert({
          template_id: template.id, description: step.description, is_default: step.is_default,
          domain_tag: step.is_default ? null : step.domain_tag, sort_order: step.sort_order ?? (steps?.length ?? 0),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchSteps(); setEditingStep(null); toast({ title: "Step saved" }); },
    onError: () => toast({ title: "Error saving step", variant: "destructive" }),
  });

  const deleteStep = async (stepId: string, desc: string) => {
    // Check if description exists in live plans
    const { data: existing } = await supabase.from("plan_action_steps").select("id").ilike("description", desc).limit(1);
    if (existing && existing.length > 0) {
      toast({ title: "Cannot delete", description: "This step exists in participant plans. Edit it instead.", variant: "destructive" });
      return;
    }
    if (!confirm("Delete this step?")) return;
    await supabase.from("plan_template_steps").delete().eq("id", stepId);
    refetchSteps();
    toast({ title: "Step deleted" });
  };

  const moveStep = async (idx: number, dir: -1 | 1) => {
    if (!steps) return;
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[idx], b = steps[target];
    await Promise.all([
      supabase.from("plan_template_steps").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("plan_template_steps").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    refetchSteps();
  };

  const duplicateTemplate = async () => {
    if (!dupTarget || dupTarget === programType) return;
    // Get all 4 phase templates for source
    const { data: srcTemplates } = await supabase.from("plan_templates").select("*")
      .eq("program_type", programType as any).eq("is_current", true);
    if (!srcTemplates?.length) { toast({ title: "No templates to copy", variant: "destructive" }); return; }

    for (const src of srcTemplates) {
      const { data: newT, error } = await supabase.from("plan_templates").insert({
        program_type: dupTarget as any, phase: src.phase, is_current: true, version: 1,
      }).select().single();
      if (error || !newT) continue;
      const { data: srcSteps } = await supabase.from("plan_template_steps").select("*").eq("template_id", src.id);
      if (srcSteps?.length) {
        await supabase.from("plan_template_steps").insert(
          srcSteps.map(s => ({ template_id: newT.id, description: s.description, is_default: s.is_default, domain_tag: s.domain_tag, sort_order: s.sort_order }))
        );
      }
    }
    setShowDuplicate(false);
    qc.invalidateQueries({ queryKey: ["plan-template"] });
    toast({ title: `Templates duplicated to ${dupTarget.replace(/_/g, " ")}` });
  };

  const createTemplate = async () => {
    const { error } = await supabase.from("plan_templates").insert({
      program_type: programType as any, phase: phase as any, is_current: true, version: 1,
    });
    if (error) { toast({ title: "Error", variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["plan-template", programType, phase] });
    toast({ title: "Template created" });
  };

  // Preview: compute which steps would show
  const previewSteps = (steps ?? []).filter(s => {
    if (s.is_default) return true;
    if (s.domain_tag && simScores[s.domain_tag] !== undefined && simScores[s.domain_tag] <= 2) return true;
    return false;
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-primary flex items-center gap-2">
        <FileText className="h-5 w-5" /> Plan Templates
      </h1>

      {/* Selectors */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Program Type</Label>
            <Select value={programType} onValueChange={setProgramType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROGRAM_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phase</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHASES.map(p => <SelectItem key={p} value={p}>{PHASE_MAP[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDuplicate(true)}>
              <Copy className="h-3 w-3 mr-1" /> Duplicate
            </Button>
            {template && steps && steps.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setSimScores({}); setShowPreview(true); }}>
                <Eye className="h-3 w-3 mr-1" /> Preview Plan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      {!template ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No template for this combination.</p>
            <Button onClick={createTemplate}>Create Template</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{PHASE_MAP[phase]} Steps ({steps?.length ?? 0})</CardTitle>
              <Button size="sm" onClick={() => setEditingStep({ description: "", is_default: true, domain_tag: null, sort_order: steps?.length ?? 0 })}>
                <Plus className="h-3 w-3 mr-1" /> Add Step
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps?.length === 0 && <p className="text-sm text-muted-foreground">No steps yet.</p>}
            {steps?.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 p-3 border border-border rounded-lg">
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveStep(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveStep(i, 1)} disabled={i === (steps.length - 1)}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{s.description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={s.is_default ? "default" : "secondary"} className="text-xs">
                      {s.is_default ? "Always Included" : "Triggered"}
                    </Badge>
                    {!s.is_default && s.domain_tag && (
                      <span className="text-xs text-muted-foreground">Domain: {domainMap.get(s.domain_tag) ?? "Unknown"}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingStep({ ...s })}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteStep(s.id, s.description)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit/Add Step Dialog */}
      <Dialog open={!!editingStep} onOpenChange={(o) => !o && setEditingStep(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingStep?.id ? "Edit Step" : "Add Step"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={editingStep?.description ?? ""} onChange={e => setEditingStep((p: any) => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editingStep?.is_default ?? true} onCheckedChange={v => setEditingStep((p: any) => ({ ...p, is_default: v }))} />
              <Label>Always Included</Label>
            </div>
            {!editingStep?.is_default && (
              <div className="space-y-1">
                <Label>Trigger Domain</Label>
                <p className="text-xs text-muted-foreground">This step is added when this domain scores 2 or below.</p>
                <Select value={editingStep?.domain_tag ?? ""} onValueChange={v => setEditingStep((p: any) => ({ ...p, domain_tag: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                  <SelectContent>
                    {domains?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" disabled={!editingStep?.description?.trim()} onClick={() => saveStep.mutate(editingStep)}>
              {saveStep.isPending ? "Saving…" : "Save Step"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicate All 4 Phases</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Copy all phases from <strong>{programType.replace(/_/g, " ")}</strong> to:</p>
          <Select value={dupTarget} onValueChange={setDupTarget}>
            <SelectTrigger><SelectValue placeholder="Select target" /></SelectTrigger>
            <SelectContent>
              {PROGRAM_TYPES.filter(t => t !== programType).map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={duplicateTemplate} disabled={!dupTarget}>Duplicate</Button>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preview: {PHASE_MAP[phase]}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Set domain scores to simulate which steps would be included (score ≤ 2 triggers conditional steps).</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {domains?.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <Label className="text-xs flex-1 truncate">{d.name}</Label>
                <Input type="number" min={1} max={5} className="w-16 h-8 text-sm" value={simScores[d.id] ?? 3}
                  onChange={e => setSimScores(prev => ({ ...prev, [d.id]: parseInt(e.target.value) || 3 }))} />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{previewSteps.length} steps would be included:</p>
            {previewSteps.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <div>
                  <p>{s.description}</p>
                  <Badge variant={s.is_default ? "default" : "secondary"} className="text-[10px] mt-1">
                    {s.is_default ? "Default" : `Triggered by ${domainMap.get(s.domain_tag ?? "") ?? "?"}`}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlanTemplatesPage;
