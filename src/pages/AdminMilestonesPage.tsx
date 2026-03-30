import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Info } from "lucide-react";

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

const AdminMilestonesPage = () => {
  const queryClient = useQueryClient();
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);

  // Fetch milestones
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["admin-milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_definitions")
        .select("id, name, description, sort_order, is_active")
        .order("sort_order");
      if (error) throw error;
      return data as Milestone[];
    },
  });

  // Fetch which milestones have been earned by participants
  const { data: earnedMilestoneIds = new Set<string>() } = useQuery({
    queryKey: ["earned-milestone-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_milestones")
        .select("milestone_id");
      return new Set((data ?? []).map((r) => r.milestone_id));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-milestones"] });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("milestone_definitions")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Milestone updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  // Save edit
  const editMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const { error } = await supabase
        .from("milestone_definitions")
        .update({ name, description })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingMilestone(null);
      toast.success("Milestone saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  // Add new
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("milestone_definitions")
        .insert({
          name: formName,
          description: formDescription,
          sort_order: formSortOrder,
          is_active: true,
        });
      if (error) throw error;
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

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("milestone_definitions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Milestone deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  // Reorder
  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOrder, swapId, swapOrder }: { id: string; newOrder: number; swapId: string; swapOrder: number }) => {
      // Update both in sequence
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
    },
    onSuccess: () => invalidate(),
  });

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const current = milestones[index];
    const above = milestones[index - 1];
    reorderMutation.mutate({
      id: current.id,
      newOrder: above.sort_order,
      swapId: above.id,
      swapOrder: current.sort_order,
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= milestones.length - 1) return;
    const current = milestones[index];
    const below = milestones[index + 1];
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
    setIsAddOpen(true);
  };

  const openEdit = (m: Milestone) => {
    setEditingMilestone(m);
    setFormName(m.name);
    setFormDescription(m.description ?? "");
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
          <p className="text-sm text-muted-foreground mt-1">{milestones.length} milestone definitions</p>
        </div>
        <Button onClick={openAdd} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Milestone
        </Button>
      </div>

      <div className="space-y-2">
        {milestones.map((m, index) => {
          const isEarned = earnedMilestoneIds.has(m.id);

          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 ${!m.is_active ? "opacity-60" : ""}`}
            >
              {/* Sort order */}
              <span className="text-sm font-mono text-muted-foreground w-6 text-center shrink-0">
                {m.sort_order}
              </span>

              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || reorderMutation.isPending}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === milestones.length - 1 || reorderMutation.isPending}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Name & description */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold text-foreground ${!m.is_active ? "line-through" : ""}`}>
                  {m.name}
                </p>
                {m.description && (
                  <p className={`text-xs text-muted-foreground mt-0.5 line-clamp-2 ${!m.is_active ? "line-through" : ""}`}>
                    {m.description}
                  </p>
                )}
              </div>

              {/* Active toggle */}
              <Switch
                checked={m.is_active}
                onCheckedChange={(checked) => toggleMutation.mutate({ id: m.id, is_active: checked })}
                className="shrink-0"
              />

              {/* Edit button */}
              <button
                onClick={() => openEdit(m)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>

              {/* Delete button */}
              {isEarned ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="p-1.5 text-muted-foreground/40 cursor-not-allowed">
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    This milestone has been earned by participants and cannot be deleted. You can deactivate it instead.
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
        })}
      </div>

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
            <div>
              <label className="text-sm font-medium text-foreground">Sort Order</label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
                className="mt-1 w-24"
              />
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
