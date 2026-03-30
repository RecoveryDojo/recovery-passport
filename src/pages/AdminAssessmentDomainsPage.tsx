import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronDown, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
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

const AdminAssessmentDomainsPage = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDomain, setNewDomain] = useState({ name: "", description: "" });

  // Fetch domains
  const { data: domains, isLoading } = useQuery({
    queryKey: ["admin-assessment-domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_domains")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all domain levels
  const { data: allLevels } = useQuery({
    queryKey: ["admin-domain-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_domain_levels")
        .select("*")
        .order("score");
      if (error) throw error;
      return data;
    },
  });

  // Fetch usage counts per domain
  const { data: usageCounts } = useQuery({
    queryKey: ["admin-domain-usage-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores")
        .select("domain_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        counts[s.domain_id] = (counts[s.domain_id] || 0) + 1;
      });
      return counts;
    },
  });

  const activeDomains = domains?.filter((d) => d.is_active) ?? [];
  const inactiveDomains = domains?.filter((d) => !d.is_active) ?? [];

  // Levels grouped by domain
  const levelsByDomain = new Map<string, typeof allLevels>();
  allLevels?.forEach((l) => {
    const arr = levelsByDomain.get(l.domain_id) ?? [];
    arr.push(l);
    levelsByDomain.set(l.domain_id, arr);
  });

  // Update domain mutation
  const updateDomain = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string | null }) => {
      const { error } = await supabase
        .from("assessment_domains")
        .update({ name, description })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-domains"] });
      toast.success("Domain updated");
    },
    onError: () => toast.error("Failed to update domain"),
  });

  // Update level mutation
  const updateLevel = useMutation({
    mutationFn: async ({ id, label, description }: { id: string; label: string; description: string | null }) => {
      const { error } = await supabase
        .from("assessment_domain_levels")
        .update({ label, description })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domain-levels"] });
      toast.success("Score level updated");
    },
    onError: () => toast.error("Failed to update score level"),
  });

  // Deactivate domain
  const deactivateDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assessment_domains")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-domains"] });
      setDeactivateTarget(null);
      toast.success("Domain deactivated");
    },
    onError: () => toast.error("Failed to deactivate domain"),
  });

  // Reactivate domain
  const reactivateDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assessment_domains")
        .update({ is_active: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-domains"] });
      toast.success("Domain reactivated");
    },
    onError: () => toast.error("Failed to reactivate domain"),
  });

  // Add new domain
  const addDomain = useMutation({
    mutationFn: async () => {
      const maxSort = Math.max(...(domains?.map((d) => d.sort_order) ?? [0]), 0);
      const { data: domain, error } = await supabase
        .from("assessment_domains")
        .insert({ name: newDomain.name, description: newDomain.description || null, sort_order: maxSort + 1, is_active: true })
        .select()
        .single();
      if (error) throw error;

      // Create 5 score levels for the new domain
      const levels = [1, 2, 3, 4, 5].map((score) => ({
        domain_id: domain.id,
        score,
        label: `Level ${score}`,
        description: "",
      }));
      const { error: levelsError } = await supabase
        .from("assessment_domain_levels")
        .insert(levels);
      if (levelsError) throw levelsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-domains"] });
      queryClient.invalidateQueries({ queryKey: ["admin-domain-levels"] });
      setAddingNew(false);
      setNewDomain({ name: "", description: "" });
      toast.success("Domain added");
    },
    onError: () => toast.error("Failed to add domain"),
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        to="/admin/content"
        className="inline-flex items-center gap-1 text-sm text-accent font-medium hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Content
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Assessment Domains</h1>
          <p className="text-sm text-muted-foreground">
            {activeDomains.length} active domain{activeDomains.length !== 1 ? "s" : ""}
          </p>
        </div>
        {activeDomains.length < 15 && (
          <Button
            size="sm"
            onClick={() => setAddingNew(true)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Domain
          </Button>
        )}
      </div>

      {/* Add new domain form */}
      {addingNew && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-foreground">New Domain</h3>
          <Input
            placeholder="Domain name"
            value={newDomain.name}
            onChange={(e) => setNewDomain((p) => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            placeholder="Description (shown to participants)"
            value={newDomain.description}
            onChange={(e) => setNewDomain((p) => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addDomain.mutate()}
              disabled={!newDomain.name.trim() || addDomain.isPending}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {addDomain.isPending ? "Adding…" : "Add Domain"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAddingNew(false); setNewDomain({ name: "", description: "" }); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Active domains */}
      <ul className="space-y-2">
        {activeDomains.map((domain) => {
          const isExpanded = expandedId === domain.id;
          const levels = levelsByDomain.get(domain.id) ?? [];
          const assessmentCount = usageCounts?.[domain.id] ?? 0;

          return (
            <li key={domain.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : domain.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{domain.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {assessmentCount} assessment score{assessmentCount !== 1 ? "s" : ""} recorded
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <DomainEditor
                  domain={domain}
                  levels={levels}
                  canDeactivate={activeDomains.length > 5}
                  onSaveDomain={(name, description) => updateDomain.mutate({ id: domain.id, name, description })}
                  onSaveLevel={(id, label, description) => updateLevel.mutate({ id, label, description })}
                  onDeactivate={() => setDeactivateTarget({ id: domain.id, name: domain.name })}
                  isSaving={updateDomain.isPending || updateLevel.isPending}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* Inactive domains */}
      {inactiveDomains.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Inactive Domains</h2>
          <ul className="space-y-2">
            {inactiveDomains.map((domain) => (
              <li key={domain.id} className="bg-muted/30 border border-border/50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-muted-foreground">{domain.name}</p>
                  <p className="text-xs text-muted-foreground/70">{domain.description}</p>
                </div>
                {activeDomains.length < 15 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reactivateDomain.mutate(domain.id)}
                    disabled={reactivateDomain.isPending}
                  >
                    Reactivate
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deactivate confirmation dialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deactivate "{deactivateTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deactivating this domain will affect future assessments. Historical data is preserved — existing assessment scores for this domain remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateTarget && deactivateDomain.mutate(deactivateTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ── Domain Editor (expanded panel) ── */

interface DomainEditorProps {
  domain: { id: string; name: string; description: string | null };
  levels: { id: string; score: number; label: string; description: string | null }[];
  canDeactivate: boolean;
  onSaveDomain: (name: string, description: string | null) => void;
  onSaveLevel: (id: string, label: string, description: string | null) => void;
  onDeactivate: () => void;
  isSaving: boolean;
}

const DomainEditor = ({ domain, levels, canDeactivate, onSaveDomain, onSaveLevel, onDeactivate, isSaving }: DomainEditorProps) => {
  const [name, setName] = useState(domain.name);
  const [description, setDescription] = useState(domain.description ?? "");
  const [editedLevels, setEditedLevels] = useState(
    levels.map((l) => ({ id: l.id, score: l.score, label: l.label, description: l.description ?? "" }))
  );

  const domainDirty = name !== domain.name || description !== (domain.description ?? "");

  return (
    <div className="border-t border-border px-4 py-4 space-y-4">
      {/* Domain fields */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Domain Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      {domainDirty && (
        <Button
          size="sm"
          onClick={() => onSaveDomain(name, description || null)}
          disabled={!name.trim() || isSaving}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          Save Domain
        </Button>
      )}

      {/* Score levels */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Score Levels (1–5)</h4>
        {editedLevels
          .sort((a, b) => a.score - b.score)
          .map((level, idx) => {
            const orig = levels.find((l) => l.id === level.id);
            const dirty = level.label !== (orig?.label ?? "") || level.description !== (orig?.description ?? "");
            return (
              <div key={level.id} className="bg-muted/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-accent w-6 text-center">{level.score}</span>
                  <Input
                    value={level.label}
                    onChange={(e) => {
                      const updated = [...editedLevels];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setEditedLevels(updated);
                    }}
                    className="text-sm"
                    placeholder="Label"
                  />
                </div>
                <Textarea
                  value={level.description}
                  onChange={(e) => {
                    const updated = [...editedLevels];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setEditedLevels(updated);
                  }}
                  rows={2}
                  className="text-sm"
                  placeholder="Description shown during assessment"
                />
                {dirty && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSaveLevel(level.id, level.label, level.description || null)}
                    disabled={isSaving}
                  >
                    Save Level {level.score}
                  </Button>
                )}
              </div>
            );
          })}
      </div>

      {/* Deactivate */}
      {canDeactivate && (
        <div className="pt-2 border-t border-border">
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDeactivate}>
            Deactivate Domain
          </Button>
        </div>
      )}
      {!canDeactivate && (
        <p className="text-xs text-muted-foreground italic pt-2">
          Cannot deactivate — minimum 5 active domains required.
        </p>
      )}
    </div>
  );
};

export default AdminAssessmentDomainsPage;
