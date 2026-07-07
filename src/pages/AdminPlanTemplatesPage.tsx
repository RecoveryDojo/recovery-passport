import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  History,
  Check,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Constants } from "@/integrations/supabase/types";

const PROGRAM_TYPES = Constants.public.Enums.template_program_type;
const PHASES = Constants.public.Enums.plan_phase;
const PHASE_MAP: Record<string, string> = {
  thirty_day: "30 Day",
  sixty_day: "60 Day",
  ninety_day: "90 Day",
  six_month: "6 Month",
};

const AdminPlanTemplatesPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [programType, setProgramType] = useState("universal");
  const [phase, setPhase] = useState("thirty_day");
  const [editingStep, setEditingStep] = useState<any>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [dupTarget, setDupTarget] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [simScores, setSimScores] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const writeAudit = async (
    action: string,
    targetType: "plan_templates" | "plan_template_steps",
    targetId: string,
    metadata?: Record<string, unknown>,
  ) => {
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata: (metadata ?? {}) as any,
    } as any);
  };

  const { data: domains } = useQuery({
    queryKey: ["assessment-domains"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assessment_domains")
        .select("id, name")
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: template, refetch: refetchTemplate } = useQuery({
    queryKey: ["plan-template", programType, phase],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_templates")
        .select("*")
        .eq("program_type", programType as any)
        .eq("phase", phase as any)
        .eq("is_current", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: allVersions } = useQuery({
    queryKey: ["plan-template-versions", programType, phase],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_templates")
        .select("*")
        .eq("program_type", programType as any)
        .eq("phase", phase as any)
        .order("version", { ascending: false });
      return data ?? [];
    },
  });

  const { data: steps, refetch: refetchSteps } = useQuery({
    queryKey: ["plan-template-steps", template?.id],
    queryFn: async () => {
      if (!template) return [];
      const { data } = await supabase
        .from("plan_template_steps")
        .select("*")
        .eq("template_id", template.id)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!template,
  });

  const domainMap = new Map(domains?.map((d) => [d.id, d.name]) ?? []);

  // Reset edit mode when switching templates
  const changeSelection = (
    nextProgram: string | null,
    nextPhase: string | null,
  ) => {
    if (isEditing) {
      const ok = confirm(
        "Leave editing? Your changes have already been saved to the new version.",
      );
      if (!ok) return;
    }
    if (nextProgram !== null) setProgramType(nextProgram);
    if (nextPhase !== null) setPhase(nextPhase);
    setIsEditing(false);
  };

  const startEditingMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No template to edit");
      const newVersion = (template.version ?? 0) + 1;

      // Unset current on old
      const { error: e1 } = await supabase
        .from("plan_templates")
        .update({ is_current: false })
        .eq("id", template.id);
      if (e1) throw e1;

      // Insert new current version
      const { data: newT, error: e2 } = await supabase
        .from("plan_templates")
        .insert({
          program_type: template.program_type,
          phase: template.phase,
          is_current: true,
          version: newVersion,
        } as any)
        .select()
        .single();
      if (e2 || !newT) throw e2 ?? new Error("Failed to create new version");

      // Clone steps
      const { data: srcSteps } = await supabase
        .from("plan_template_steps")
        .select("*")
        .eq("template_id", template.id);
      if (srcSteps?.length) {
        const { error: e3 } = await supabase.from("plan_template_steps").insert(
          srcSteps.map((s) => ({
            template_id: newT.id,
            description: s.description,
            is_default: s.is_default,
            domain_tag: s.domain_tag,
            sort_order: s.sort_order,
          })),
        );
        if (e3) throw e3;
      }

      await writeAudit("new_plan_template_version", "plan_templates", newT.id, {
        program_type: template.program_type,
        phase: template.phase,
        version: newVersion,
        cloned_from: template.id,
      });

      return newT;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-template", programType, phase] });
      qc.invalidateQueries({ queryKey: ["plan-template-versions", programType, phase] });
      setIsEditing(true);
      toast.success("New draft version created. Edits apply to new plans only.");
    },
    onError: () => toast.error("Failed to start editing"),
  });

  const saveStep = useMutation({
    mutationFn: async (step: any) => {
      if (step.id) {
        const { error } = await supabase
          .from("plan_template_steps")
          .update({
            description: step.description,
            is_default: step.is_default,
            domain_tag: step.is_default ? null : step.domain_tag,
            sort_order: step.sort_order,
          })
          .eq("id", step.id);
        if (error) throw error;
        await writeAudit("edit_plan_step", "plan_template_steps", step.id, {
          template_id: template?.id,
          template_version: template?.version,
        });
      } else {
        if (!template) throw new Error("No template");
        const { data: inserted, error } = await supabase
          .from("plan_template_steps")
          .insert({
            template_id: template.id,
            description: step.description,
            is_default: step.is_default,
            domain_tag: step.is_default ? null : step.domain_tag,
            sort_order: step.sort_order ?? (steps?.length ?? 0),
          })
          .select("id")
          .single();
        if (error) throw error;
        await writeAudit("add_plan_step", "plan_template_steps", inserted.id, {
          template_id: template.id,
          template_version: template.version,
          is_default: step.is_default,
        });
      }
    },
    onSuccess: () => {
      refetchSteps();
      setEditingStep(null);
      toast.success("Step saved");
    },
    onError: () => toast.error("Failed to save step"),
  });

  const deleteStep = async (stepId: string) => {
    if (!confirm("Delete this step from this template version?")) return;
    const { error } = await supabase
      .from("plan_template_steps")
      .delete()
      .eq("id", stepId);
    if (error) {
      toast.error("Failed to delete step");
      return;
    }
    await writeAudit("delete_plan_step", "plan_template_steps", stepId, {
      template_id: template?.id,
      template_version: template?.version,
    });
    refetchSteps();
    toast.success("Step removed");
  };

  const moveStep = async (idx: number, dir: -1 | 1) => {
    if (!steps) return;
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[idx],
      b = steps[target];
    await Promise.all([
      supabase.from("plan_template_steps").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("plan_template_steps").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await writeAudit("reorder_plan_step", "plan_template_steps", a.id, {
      template_id: template?.id,
      template_version: template?.version,
      swapped_with: b.id,
    });
    refetchSteps();
  };

  const duplicateTemplate = async () => {
    if (!dupTarget || dupTarget === programType) return;
    const { data: srcTemplates } = await supabase
      .from("plan_templates")
      .select("*")
      .eq("program_type", programType as any)
      .eq("is_current", true);
    if (!srcTemplates?.length) {
      toast.error("No templates to copy");
      return;
    }

    for (const src of srcTemplates) {
      const { data: newT, error } = await supabase
        .from("plan_templates")
        .insert({
          program_type: dupTarget as any,
          phase: src.phase,
          is_current: true,
          version: 1,
        } as any)
        .select()
        .single();
      if (error || !newT) continue;
      const { data: srcSteps } = await supabase
        .from("plan_template_steps")
        .select("*")
        .eq("template_id", src.id);
      if (srcSteps?.length) {
        await supabase.from("plan_template_steps").insert(
          srcSteps.map((s) => ({
            template_id: newT.id,
            description: s.description,
            is_default: s.is_default,
            domain_tag: s.domain_tag,
            sort_order: s.sort_order,
          })),
        );
      }
      await writeAudit("duplicate_plan_template", "plan_templates", newT.id, {
        from_program_type: programType,
        to_program_type: dupTarget,
        phase: src.phase,
      });
    }
    setShowDuplicate(false);
    qc.invalidateQueries({ queryKey: ["plan-template"] });
    qc.invalidateQueries({ queryKey: ["plan-template-versions"] });
    toast.success(`Templates duplicated to ${dupTarget.replace(/_/g, " ")}`);
  };

  const createTemplate = async () => {
    const { data: inserted, error } = await supabase
      .from("plan_templates")
      .insert({
        program_type: programType as any,
        phase: phase as any,
        is_current: true,
        version: 1,
      } as any)
      .select("id")
      .single();
    if (error) {
      toast.error("Failed to create template");
      return;
    }
    await writeAudit("create_plan_template", "plan_templates", inserted.id, {
      program_type: programType,
      phase,
    });
    qc.invalidateQueries({ queryKey: ["plan-template", programType, phase] });
    qc.invalidateQueries({ queryKey: ["plan-template-versions", programType, phase] });
    toast.success("Template created");
  };

  const previewSteps = (steps ?? []).filter((s) => {
    if (s.is_default) return true;
    if (s.domain_tag && simScores[s.domain_tag] !== undefined && simScores[s.domain_tag] <= 2)
      return true;
    return false;
  });

  const historyVersions = (allVersions ?? []).filter((v) => !v.is_current);

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
            <Select value={programType} onValueChange={(v) => changeSelection(v, null)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRAM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phase</Label>
            <Select value={phase} onValueChange={(v) => changeSelection(null, v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PHASE_MAP[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDuplicate(true)}>
              <Copy className="h-3 w-3 mr-1" /> Duplicate
            </Button>
            {template && steps && steps.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSimScores({});
                  setShowPreview(true);
                }}
              >
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                {PHASE_MAP[phase]} Steps ({steps?.length ?? 0})
                <Badge variant="outline" className="text-xs">
                  v{template.version}
                </Badge>
                {isEditing && (
                  <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Editing</Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button
                    size="sm"
                    onClick={() => startEditingMutation.mutate()}
                    disabled={startEditingMutation.isPending}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    {startEditingMutation.isPending ? "Creating draft…" : "Edit Template"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        setEditingStep({
                          description: "",
                          is_default: true,
                          domain_tag: null,
                          sort_order: steps?.length ?? 0,
                        })
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Step
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                      <Check className="h-3 w-3 mr-1" /> Done
                    </Button>
                  </>
                )}
              </div>
            </div>
            {isEditing && (
              <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  You are editing <strong>version {template.version}</strong>. The previous
                  version is preserved in history. Existing participant plans that were already
                  generated are not affected — only newly generated plans use this version.
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {steps?.length === 0 && (
              <p className="text-sm text-muted-foreground">No steps yet.</p>
            )}
            {steps?.map((s, i) => (
              <div
                key={s.id}
                className="flex items-start gap-2 p-3 border border-border rounded-lg"
              >
                {isEditing && (
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === (steps?.length ?? 1) - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{s.description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge
                      variant={s.is_default ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {s.is_default ? "Always Included" : "Triggered"}
                    </Badge>
                    {!s.is_default && s.domain_tag && (
                      <span className="text-xs text-muted-foreground">
                        Domain: {domainMap.get(s.domain_tag) ?? "Unknown"}
                      </span>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingStep({ ...s })}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteStep(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Version history */}
      {historyVersions.length > 0 && (
        <Card>
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4" />
                  Version History ({historyVersions.length})
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border p-4 space-y-2">
                {historyVersions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-card"
                  >
                    <div>
                      <p className="text-sm font-medium">Version {v.version}</p>
                      <p className="text-xs text-muted-foreground">
                        Saved {format(new Date(v.updated_at ?? v.created_at ?? Date.now()), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setViewingVersion(v)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Edit/Add Step Dialog */}
      <Dialog open={!!editingStep} onOpenChange={(o) => !o && setEditingStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep?.id ? "Edit Step" : "Add Step"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={editingStep?.description ?? ""}
                onChange={(e) =>
                  setEditingStep((p: any) => ({ ...p, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingStep?.is_default ?? true}
                onCheckedChange={(v) => setEditingStep((p: any) => ({ ...p, is_default: v }))}
              />
              <Label>Always Included</Label>
            </div>
            {!editingStep?.is_default && (
              <div className="space-y-1">
                <Label>Trigger Domain</Label>
                <p className="text-xs text-muted-foreground">
                  This step is added when this domain scores 2 or below.
                </p>
                <Select
                  value={editingStep?.domain_tag ?? ""}
                  onValueChange={(v) =>
                    setEditingStep((p: any) => ({ ...p, domain_tag: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              disabled={
                !editingStep?.description?.trim() ||
                (!editingStep?.is_default && !editingStep?.domain_tag) ||
                saveStep.isPending
              }
              onClick={() => saveStep.mutate(editingStep)}
            >
              {saveStep.isPending ? "Saving…" : "Save Step"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate All 4 Phases</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy all phases from <strong>{programType.replace(/_/g, " ")}</strong> to:
          </p>
          <Select value={dupTarget} onValueChange={setDupTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              {PROGRAM_TYPES.filter((t) => t !== programType).map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={duplicateTemplate} disabled={!dupTarget}>
            Duplicate
          </Button>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {PHASE_MAP[phase]}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Set domain scores to simulate which steps would be included (score ≤ 2 triggers
            conditional steps).
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {domains?.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <Label className="text-xs flex-1 truncate">{d.name}</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  className="w-16 h-8 text-sm"
                  value={simScores[d.id] ?? 3}
                  onChange={(e) =>
                    setSimScores((prev) => ({
                      ...prev,
                      [d.id]: parseInt(e.target.value) || 3,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {previewSteps.length} steps would be included:
            </p>
            {previewSteps.map((s, i) => (
              <div
                key={s.id}
                className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded"
              >
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <div>
                  <p>{s.description}</p>
                  <Badge
                    variant={s.is_default ? "default" : "secondary"}
                    className="text-[10px] mt-1"
                  >
                    {s.is_default
                      ? "Default"
                      : `Triggered by ${domainMap.get(s.domain_tag ?? "") ?? "?"}`}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Historical Version */}
      <VersionViewer
        version={viewingVersion}
        onClose={() => setViewingVersion(null)}
        domainMap={domainMap}
      />
    </div>
  );
};

const VersionViewer = ({
  version,
  onClose,
  domainMap,
}: {
  version: any;
  onClose: () => void;
  domainMap: Map<string, string>;
}) => {
  const { data: versionSteps } = useQuery({
    queryKey: ["plan-template-steps-version", version?.id],
    queryFn: async () => {
      if (!version) return [];
      const { data } = await supabase
        .from("plan_template_steps")
        .select("*")
        .eq("template_id", version.id)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!version,
  });

  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Version {version?.version}
            <span className="ml-2 text-xs text-muted-foreground font-normal">(read-only)</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(versionSteps ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground italic">No steps in this version.</p>
          )}
          {(versionSteps ?? []).map((s: any, i: number) => (
            <div key={s.id} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-sm">
              <span className="text-muted-foreground shrink-0">{i + 1}.</span>
              <div>
                <p>{s.description}</p>
                <Badge
                  variant={s.is_default ? "default" : "secondary"}
                  className="text-[10px] mt-1"
                >
                  {s.is_default
                    ? "Default"
                    : `Triggered by ${domainMap.get(s.domain_tag ?? "") ?? "?"}`}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPlanTemplatesPage;
