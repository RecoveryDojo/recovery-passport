import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Lock, Plus, Trash2, Save } from "lucide-react";

type Instrument = {
  id: string;
  title: string;
  description: string | null;
  source: "standard" | "custom";
  is_locked: boolean;
  status: "draft" | "published" | "archived";
  scoring_method: "sum" | "average";
  higher_is_better: boolean;
  min_score: number | null;
  max_score: number | null;
};

type Item = {
  id: string;
  prompt: string;
  item_type: string;
  sort_order: number;
  is_required: boolean;
  is_reverse_scored: boolean;
  is_flag_item: boolean;
  flag_threshold: number | null;
  options?: { id: string; label: string; value: number; sort_order: number }[];
};

type Band = {
  id: string;
  min_score: number;
  max_score: number;
  label: string;
  severity: "none" | "mild" | "moderate" | "severe";
  guidance: string | null;
  triggers_alert: boolean;
};

const AdminAssessmentInstrumentDetailPage = () => {
  const { instrumentId } = useParams<{ instrumentId: string }>();
  const qc = useQueryClient();
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemPrompt, setNewItemPrompt] = useState("");
  const [newItemType, setNewItemType] = useState("labeled_scale");

  const { data: instrument } = useQuery({
    queryKey: ["admin-instrument", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments")
        .select("*")
        .eq("id", instrumentId!)
        .single();
      if (error) throw error;
      return data as Instrument;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["admin-instrument-items", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data: itemRows, error } = await supabase
        .from("assessment_instrument_items")
        .select("*")
        .eq("instrument_id", instrumentId!)
        .order("sort_order");
      if (error) throw error;
      const ids = itemRows.map((r) => r.id);
      const { data: optRows } = ids.length
        ? await supabase
            .from("assessment_instrument_options")
            .select("*")
            .in("item_id", ids)
            .order("sort_order")
        : { data: [] as any[] };
      return itemRows.map((r) => ({
        ...r,
        options: (optRows ?? []).filter((o) => o.item_id === r.id),
      })) as Item[];
    },
  });

  const { data: bands } = useQuery({
    queryKey: ["admin-instrument-bands", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_bands")
        .select("*")
        .eq("instrument_id", instrumentId!)
        .order("min_score");
      if (error) throw error;
      return data as Band[];
    },
  });

  const locked = instrument?.is_locked ?? false;

  const updateInstrument = useMutation({
    mutationFn: async (patch: Partial<Instrument>) => {
      const { error } = await supabase
        .from("assessment_instruments")
        .update(patch)
        .eq("id", instrumentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-instrument", instrumentId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const nextOrder = (items?.length ?? 0) + 1;
      const { error } = await supabase.from("assessment_instrument_items").insert({
        instrument_id: instrumentId!,
        prompt: newItemPrompt.trim(),
        item_type: newItemType as any,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-instrument-items", instrumentId] });
      setShowNewItem(false);
      setNewItemPrompt("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_instrument_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-instrument-items", instrumentId] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (!instrument) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <Link
        to="/admin/content/instruments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Assessment Library
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{instrument.title}</h1>
            <Badge variant={instrument.source === "standard" ? "default" : "secondary"} className="text-xs">
              {instrument.source}
            </Badge>
            {locked && (
              <Badge variant="outline" className="text-xs gap-1">
                <Lock className="h-3 w-3" /> locked
              </Badge>
            )}
          </div>
          {instrument.description && (
            <p className="text-sm text-muted-foreground mt-2">{instrument.description}</p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Settings</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select
                value={instrument.status}
                disabled={locked}
                onValueChange={(v) => updateInstrument.mutate({ status: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scoring method</Label>
              <Select
                value={instrument.scoring_method}
                disabled={locked}
                onValueChange={(v) => updateInstrument.mutate({ scoring_method: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Min score</Label>
              <Input
                type="number"
                defaultValue={instrument.min_score ?? ""}
                disabled={locked}
                onBlur={(e) => updateInstrument.mutate({ min_score: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Max score</Label>
              <Input
                type="number"
                defaultValue={instrument.max_score ?? ""}
                disabled={locked}
                onBlur={(e) => updateInstrument.mutate({ max_score: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Checkbox
                id="hib"
                checked={instrument.higher_is_better}
                disabled={locked}
                onCheckedChange={(v) => updateInstrument.mutate({ higher_is_better: !!v })}
              />
              <Label htmlFor="hib" className="cursor-pointer">
                Higher score = better outcome (RC-style). Uncheck for symptom scales like PHQ-9/GAD-7.
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Items ({items?.length ?? 0})</h2>
            {!locked && (
              <Button size="sm" onClick={() => setShowNewItem(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add item
              </Button>
            )}
          </div>
          {!items || items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {idx + 1}. {it.prompt}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{it.item_type}</Badge>
                        {it.is_flag_item && (
                          <Badge variant="destructive" className="text-xs">
                            flag ≥ {it.flag_threshold}
                          </Badge>
                        )}
                        {it.is_reverse_scored && (
                          <Badge variant="outline" className="text-xs">reverse-scored</Badge>
                        )}
                      </div>
                      {it.options && it.options.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Options: {it.options.map((o) => `${o.label} (${o.value})`).join(" · ")}
                        </p>
                      )}
                    </div>
                    {!locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem.mutate(it.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bands */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Score bands ({bands?.length ?? 0})</h2>
          {!bands || bands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bands defined.</p>
          ) : (
            <div className="space-y-2">
              {bands.map((b) => (
                <div key={b.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      {b.min_score}–{b.max_score}: {b.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{b.severity}</Badge>
                      {b.triggers_alert && (
                        <Badge variant="destructive" className="text-xs">alert</Badge>
                      )}
                    </div>
                  </div>
                  {b.guidance && (
                    <p className="text-xs text-muted-foreground mt-1">{b.guidance}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {locked && (
            <p className="text-xs text-muted-foreground italic">
              Standard instruments are locked. Duplicate this instrument as a custom to modify.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Prompt</Label>
              <Textarea value={newItemPrompt} onChange={(e) => setNewItemPrompt(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Item type</Label>
              <Select value={newItemType} onValueChange={setNewItemType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labeled_scale">Labeled scale</SelectItem>
                  <SelectItem value="single_select">Single select</SelectItem>
                  <SelectItem value="multi_select">Multi select</SelectItem>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="free_text">Free text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Add option choices from the item detail after creating. (Option-editor coming soon.)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItem(false)}>Cancel</Button>
            <Button disabled={!newItemPrompt.trim() || addItem.isPending} onClick={() => addItem.mutate()}>
              <Save className="h-4 w-4 mr-1" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAssessmentInstrumentDetailPage;
