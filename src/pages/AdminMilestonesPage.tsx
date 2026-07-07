import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  level_threshold: number | null;
  is_active: boolean;
};

const LEVEL_OPTIONS = [
  { value: 1, label: "Rookie" },
  { value: 2, label: "Starter" },
  { value: 3, label: "Veteran" },
  { value: 4, label: "All-Star" },
];

const LEVEL_TONE: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-blue-100 text-blue-700",
  3: "bg-purple-100 text-purple-700",
  4: "bg-amber-100 text-amber-700",
};

const levelLabel = (v: number | null) => LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? "—";

const AdminMilestonesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formLevel, setFormLevel] = useState<number>(1);

  const writeAudit = async (action: string, targetId: string, metadata?: Record<string, unknown>) => {
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      action,
      target_type: "milestone_definitions",
      target_id: targetId,
      metadata: metadata ?? {},
    });
  };

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["admin-milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_definitions")
        .select("id, name, description, sort_order, level_threshold, is_active")
        .order("sort_order");
      if (error) throw error;
      return data as Milestone[];
    },
  });

  const { data: earnedMilestoneIds = new Set<string>() } = useQuery({
    queryKey: ["earned-milestone-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_milestones")
        .select("milestone_id");
      return new Set((data ?? []).map((r) => r.milestone_id));
    },
  });

  const activeMilestones = milestones.filter((m) => m.is_active);
  const inactiveMilestones = milestones.filter((m) => !m.is_active);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-milestones"] });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("milestone_definitions")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
      await writeAudit(is_active ? "reactivate_milestone" : "deactivate_milestone", id, { is_active });
    },
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(vars.is_active ? "Milestone reactivated" : "Milestone deactivated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      level_threshold,
    }: {
      id: string;
      name: string;
      description: string;
      level_threshold: number;
    }) => {
      const { error } = await supabase
        .from("milestone_definitions")
        .update({ name, description, level_threshold })
        .eq("id", id);
      if (error) throw error;
      await writeAudit("edit_milestone", id, { name, level_threshold });
    },
    onSuccess: () => {
      invalidate();
      setEditingMilestone(null);
      toast.success("Milestone saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("milestone_definitions")
        .insert({
          name: formName,
          description: formDescription,
          sort_order: formSortOrder,
          level_threshold: formLevel,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      await writeAudit("add_milestone", data.id, { name: formName, level_threshold: formLevel });
    },
    onSuccess: () => {
      invalidate();
      setIsAddOpen(false);
      setFormName("");
      setFormDescription("");
      toast.success("Milestone added");
    },
    onError: () => toast.error("Failed to add milestone"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestone_definitions").delete().eq("id", id);
      if (error) throw error;
      await writeAudit("delete_milestone", id, {});
    },
    onSuccess: () => {
      invalidate();
      toast.success("Milestone deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      id,
      newOrder,
      swapId,
      swapOrder,
    }: {
      id: string;
      newOrder: number;
      swapId: string;
      swapOrder: number;
    }) => {
      const { error: e1 } = await supabase
        .from("milestone_definitions")
        .update({ sort_order: newOrder })
        .eq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("milestone_definitions")
        .update({ sort_order: swapOrder })
        .eq("id", swapId);
      if (e2) throw e2;
      await writeAudit("reorder_milestone", id, { from: swapOrder, to: newOrder, swapped_with: swapId });
    },
    onSuccess: () => invalidate(),
  });

  const handleMoveUp = (list: Milestone[], index: number) => {
    if (index <= 0) return;
    const current = list[index];
    const above = list[index - 1];
    reorderMutation.mutate({
      id: current.id,
      newOrder: above.sort_order,
      swapId: above.id,
      swapOrder: current.sort_order,
    });
  };

  const handleMoveDown = (list: Milestone[], index: number) => {
    if (index >= list.length - 1) return;
    const current = list[index];
    const below = list[index + 1];
    reorderMutation.mutate({
      id: current.id,
      newOrder: below.sort_order,
      swapId: below.id,
      swapOrder: current.sort_order,
    });
  };

  const openAdd = () => {
    const maxOrder = milestones.length > 0 ? Math.max(...milestones.map((m) => m.sort_order)) : 0;
    setFormSortOrder(maxOrder + 1);
    setFormName("");
    setFormDescription("");
    setFormLevel(1);
    setIsAddOpen(true);
  };

  const openEdit = (m: Milestone) => {
    setEditingMilestone(m);
    setFormName(m.name);
    setFormDescription(m.description ?? "");
    setFormLevel(m.level_threshold ?? 1);
  };

  const renderRow = (list: Milestone[], m: Milestone, index: number) => {
    const isEarned = earnedMilestoneIds.has(m.id);
    return (
      <div
        key={m.id}
        className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 ${
          !m.is_active ? "opacity-60" : ""
        }`}
      >
        <span className="text-sm font-mono text-muted-foreground w-6 text-center shrink-0">
          {m.sort_order}
        </span>

        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={() => handleMoveUp(list, index)}
            disabled={index === 0 || reorderMutation.isPending}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleMoveDown(list, index)}
            disabled={index === list.length - 1 || reorderMutation.isPending}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold text-foreground ${!m.is_active ? "line-through" : ""}`}>
              {m.name}
            </p>
            {m.level_threshold != null && (
              <Badge className={`${LEVEL_TONE[m.level_threshold] ?? LEVEL_TONE[1]} border-0 text-[10px]`}>
                {levelLabel(m.level_threshold)}
              </Badge>
            )}
            {!m.is_active && (
              <Badge variant="outline" className="text-[10px]">
                Inactive
              </Badge>
            )}
          </div>
          {m.description && (
            <p className={`text-xs text-muted-foreground mt-0.5 line-clamp-2 ${!m.is_active ? "line-through" : ""}`}>
              {m.description}
            </p>
          )}
        </div>

        <Switch
          checked={m.is_active}
          onCheckedChange={(checked) => toggleMutation.mutate({ id: m.id, is_active: checked })}
          className="shrink-0"
        />

        <button
          onClick={() => openEdit(m)}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>

        {isEarned ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="p-1.5 text-muted-foreground/40 cursor-not-allowed">
                <Trash2 className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">
              This milestone has been earned by participants and cannot be deleted. Deactivate it instead.
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => deleteMutation.mutate(m.id)}
            className="p-1.5 text-destructive/60 hover:text-destructive transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading milestones…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Milestones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeMilestones.length} active · {inactiveMilestones.length} inactive
          </p>
        </div>
        <Button onClick={openAdd} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Milestone
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active</h2>
        {activeMilestones.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No active milestones.</p>
        ) : (
          activeMilestones.map((m, i) => renderRow(activeMilestones, m, i))
        )}
      </section>

      {inactiveMilestones.length > 0 && (
        <section className="space-y-2 pt-4 border-t border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Inactive
          </h2>
          <p className="text-xs text-muted-foreground">
            Hidden going forward. Participants who already earned these keep them.
          </p>
          {inactiveMilestones.map((m, i) => renderRow(inactiveMilestones, m, i))}
        </section>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Name *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Completed Intake"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description *</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what the participant achieves…"
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Level Threshold *</label>
                <Select
                  value={String(formLevel)}
                  onValueChange={(v) => setFormLevel(Number(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.value} · {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Sort Order</label>
                <Input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!formName.trim() || !formDescription.trim() || addMutation.isPending}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Add Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingMilestone} onOpenChange={(open) => !open && setEditingMilestone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Level Threshold</label>
              <Select
                value={String(formLevel)}
                onValueChange={(v) => setFormLevel(Number(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.value} · {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMilestone(null)}>Cancel</Button>
            <Button
              onClick={() =>
                editingMilestone &&
                editMutation.mutate({
                  id: editingMilestone.id,
                  name: formName,
                  description: formDescription,
                  level_threshold: formLevel,
                })
              }
              disabled={!formName.trim() || editMutation.isPending}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMilestonesPage;
