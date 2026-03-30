import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { updateCrpsCompetencies } from "@/lib/crps-updater";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock, Check, Pencil, Trash2, Plus, ArrowUp, ArrowDown, X, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PHASE_ORDER = ["thirty_day", "sixty_day", "ninety_day", "six_month"] as const;
const PHASE_LABELS: Record<string, string> = {
  thirty_day: "30 Day",
  sixty_day: "60 Day",
  ninety_day: "90 Day",
  six_month: "6 Mo",
};

interface PeerPlanTabProps {
  participantId: string;
  participantUserId: string;
}

const PeerPlanTab = ({ participantId, participantUserId }: PeerPlanTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [addingToPhase, setAddingToPhase] = useState<string | null>(null);
  const [newStepText, setNewStepText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; desc: string } | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; label: string } | null>(null);

  const { data: plan } = useQuery({
    queryKey: ["recovery-plan", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_plans")
        .select("id")
        .eq("participant_id", participantId)
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: phases } = useQuery({
    queryKey: ["plan-phases", plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_phases")
        .select("id, phase, title, focus_description, is_active")
        .eq("plan_id", plan!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: allSteps } = useQuery({
    queryKey: ["plan-steps", plan?.id],
    enabled: !!plan?.id && !!phases,
    queryFn: async () => {
      const phaseIds = phases?.map((p) => p.id) ?? [];
      if (phaseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("plan_action_steps")
        .select("id, phase_id, description, is_completed, completed_at, sort_order")
        .in("phase_id", phaseIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const sortedPhases = phases
    ? [...phases].sort((a, b) => PHASE_ORDER.indexOf(a.phase as any) - PHASE_ORDER.indexOf(b.phase as any))
    : [];

  const effectiveTab =
    activeTab && sortedPhases.some((p) => p.phase === activeTab)
      ? activeTab
      : sortedPhases.find((p) => p.is_active)?.phase ?? sortedPhases[0]?.phase ?? null;

  const currentPhase = sortedPhases.find((p) => p.phase === effectiveTab);
  const currentSteps = (allSteps?.filter((s) => s.phase_id === currentPhase?.id) ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const completedCount = currentSteps.filter((s) => s.is_completed).length;
  const totalCount = currentSteps.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["plan-steps", plan?.id] });
    queryClient.invalidateQueries({ queryKey: ["plan-phases", plan?.id] });
  };

  // Toggle step completion
  const toggleStepMutation = useMutation({
    mutationFn: async ({ stepId, completed }: { stepId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("plan_action_steps")
        .update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", stepId);
      if (error) throw error;

      // Check phase unlock
      if (completed && currentPhase) {
        const phaseSteps = allSteps?.filter((s) => s.phase_id === currentPhase.id) ?? [];
        const newCount = phaseSteps.filter((s) => (s.id === stepId ? completed : s.is_completed)).length;
        const pct = phaseSteps.length > 0 ? newCount / phaseSteps.length : 0;
        if (pct >= 0.8) {
          const currentIdx = PHASE_ORDER.indexOf(currentPhase.phase as any);
          const nextPhase = sortedPhases[currentIdx + 1];
          if (nextPhase && !nextPhase.is_active) {
            await supabase.from("plan_phases").update({ is_active: true }).eq("id", nextPhase.id);
            await supabase.from("notifications").insert({
              user_id: participantUserId,
              type: "plan_updated" as const,
              title: "New Phase Unlocked!",
              body: `${PHASE_LABELS[nextPhase.phase]} phase is now available in your recovery plan!`,
              link: "/plan",
            });
            toast.success(`${PHASE_LABELS[nextPhase.phase]} phase is now unlocked! 🎉`);
          }
        }
      }
    },
    onSuccess: invalidateAll,
    onError: (err: any) => toast.error(err.message),
  });

  // Edit step description
  const editStepMutation = useMutation({
    mutationFn: async ({ stepId, description }: { stepId: string; description: string }) => {
      const { error } = await supabase
        .from("plan_action_steps")
        .update({ description })
        .eq("id", stepId);
      if (error) throw error;
      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: "edit_plan_step",
        target_type: "plan_action_steps",
        target_id: stepId,
        metadata: { description },
      });
    },
    onSuccess: () => {
      setEditingStepId(null);
      invalidateAll();
      toast.success("Step updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Add step
  const addStepMutation = useMutation({
    mutationFn: async ({ phaseId, description }: { phaseId: string; description: string }) => {
      const maxOrder = currentSteps.length > 0 ? Math.max(...currentSteps.map((s) => s.sort_order)) : -1;
      const { data, error } = await supabase
        .from("plan_action_steps")
        .insert({ phase_id: phaseId, description, sort_order: maxOrder + 1 })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: "edit_plan_step",
        target_type: "plan_action_steps",
        target_id: data.id,
        metadata: { action: "added", description },
      });
    },
    onSuccess: () => {
      setAddingToPhase(null);
      setNewStepText("");
      invalidateAll();
      toast.success("Step added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete step
  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from("plan_action_steps").delete().eq("id", stepId);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: "edit_plan_step",
        target_type: "plan_action_steps",
        target_id: stepId,
        metadata: { action: "removed" },
      });
    },
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateAll();
      toast.success("Step removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Reorder step
  const reorderMutation = useMutation({
    mutationFn: async ({ stepId, direction }: { stepId: string; direction: "up" | "down" }) => {
      const idx = currentSteps.findIndex((s) => s.id === stepId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= currentSteps.length) return;
      const a = currentSteps[idx];
      const b = currentSteps[swapIdx];
      await Promise.all([
        supabase.from("plan_action_steps").update({ sort_order: b.sort_order }).eq("id", a.id),
        supabase.from("plan_action_steps").update({ sort_order: a.sort_order }).eq("id", b.id),
      ]);
    },
    onSuccess: invalidateAll,
    onError: (err: any) => toast.error(err.message),
  });

  // Manual phase unlock
  const unlockPhaseMutation = useMutation({
    mutationFn: async (phaseId: string) => {
      const { error } = await supabase.from("plan_phases").update({ is_active: true }).eq("id", phaseId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: participantUserId,
        type: "plan_updated" as const,
        title: "Phase Unlocked!",
        body: `Your peer specialist has unlocked a new phase in your recovery plan.`,
        link: "/plan",
      });
    },
    onSuccess: () => {
      setUnlockTarget(null);
      invalidateAll();
      toast.success("Phase manually unlocked");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // No plan
  if (plan === null || plan === undefined) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">
          No recovery plan yet. It will be generated after the participant completes their first assessment.
        </p>
      </div>
    );
  }

  if (!phases || !allSteps) {
    return <p className="text-muted-foreground text-sm">Loading plan…</p>;
  }

  const getPhaseStatus = (phase: (typeof sortedPhases)[0]) => {
    const steps = allSteps.filter((s) => s.phase_id === phase.id);
    const done = steps.filter((s) => s.is_completed).length;
    return { isActive: phase.is_active, allDone: steps.length > 0 && done === steps.length };
  };

  return (
    <div className="space-y-4">
      {/* Phase tabs */}
      <div className="flex gap-2">
        {sortedPhases.map((phase) => {
          const { isActive, allDone } = getPhaseStatus(phase);
          const isSelected = phase.phase === effectiveTab;
          return (
            <button
              key={phase.id}
              onClick={() => setActiveTab(phase.phase)}
              className={cn(
                "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                !isActive && "bg-muted text-muted-foreground",
                isActive && allDone && "bg-green-600 text-white",
                isActive && !allDone && isSelected && "bg-primary text-primary-foreground",
                isActive && !allDone && !isSelected && "bg-primary/20 text-primary hover:bg-primary/30"
              )}
            >
              {!isActive && <Lock className="h-3 w-3" />}
              {allDone && isActive && <Check className="h-3 w-3" />}
              {PHASE_LABELS[phase.phase]}
            </button>
          );
        })}
      </div>

      {/* Manual unlock for locked phases */}
      {currentPhase && !currentPhase.is_active && (
        <div className="bg-muted/50 border border-border rounded-xl p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">This phase is locked.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setUnlockTarget({ id: currentPhase.id, label: PHASE_LABELS[currentPhase.phase] })
            }
          >
            <Lock className="h-3 w-3 mr-1" /> Unlock Phase
          </Button>
        </div>
      )}

      {/* Phase content */}
      {currentPhase && currentPhase.is_active && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{currentPhase.title}</h2>
            {currentPhase.focus_description && (
              <p className="text-sm text-muted-foreground italic mt-1">{currentPhase.focus_description}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} of {totalCount} steps complete</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-3 [&>div]:bg-accent" />
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {currentSteps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-2 bg-card border border-border rounded-xl px-3 py-3",
                  step.is_completed && "bg-accent/5 border-accent/20"
                )}
              >
                <Checkbox
                  checked={step.is_completed}
                  disabled={toggleStepMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleStepMutation.mutate({ stepId: step.id, completed: !!checked })
                  }
                  className="mt-0.5 flex-shrink-0"
                />

                {editingStepId === step.id ? (
                  <div className="flex-1 flex gap-1">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => editStepMutation.mutate({ stepId: step.id, description: editText })}
                      disabled={!editText.trim() || editStepMutation.isPending}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => setEditingStepId(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      "flex-1 text-sm text-foreground",
                      step.is_completed && "line-through text-muted-foreground"
                    )}
                  >
                    {step.description}
                  </span>
                )}

                {editingStepId !== step.id && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => reorderMutation.mutate({ stepId: step.id, direction: "up" })}
                      disabled={idx === 0 || reorderMutation.isPending}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => reorderMutation.mutate({ stepId: step.id, direction: "down" })}
                      disabled={idx === currentSteps.length - 1 || reorderMutation.isPending}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingStepId(step.id);
                        setEditText(step.description);
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: step.id, desc: step.description })}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add step */}
          {addingToPhase === currentPhase.id ? (
            <div className="flex gap-2">
              <Input
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                placeholder="Step description…"
                className="h-9 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() =>
                  addStepMutation.mutate({ phaseId: currentPhase.id, description: newStepText })
                }
                disabled={!newStepText.trim() || addStepMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingToPhase(null);
                  setNewStepText("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingToPhase(currentPhase.id)}
              className="text-accent hover:text-accent/80"
            >
              <Plus className="h-4 w-4 mr-1" /> Add action step
            </Button>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this step?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              "{deleteTarget?.desc}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteStepMutation.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation */}
      <AlertDialog open={!!unlockTarget} onOpenChange={() => setUnlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock {unlockTarget?.label} phase?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlock the phase even though the previous phase isn't 80% complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlockTarget && unlockPhaseMutation.mutate(unlockTarget.id)}
            >
              Unlock Phase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PeerPlanTab;
