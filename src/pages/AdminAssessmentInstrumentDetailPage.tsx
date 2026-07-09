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
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Lock, Plus, Trash2, Save, ChevronUp, ChevronDown, AlertTriangle, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ItemType = "labeled_scale" | "single_select" | "multi_select" | "yes_no" | "numeric" | "free_text";
const OPTION_BASED: ItemType[] = ["labeled_scale", "single_select", "multi_select", "yes_no"];

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

type Option = { id: string; item_id: string; label: string; value: number; sort_order: number };

type Item = {
  id: string;
  prompt: string;
  item_type: ItemType;
  sort_order: number;
  is_required: boolean;
  is_reverse_scored: boolean;
  is_flag_item: boolean;
  flag_threshold: number | null;
  options?: Option[];
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
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemPrompt, setNewItemPrompt] = useState("");
  const [newItemType, setNewItemType] = useState<ItemType>("labeled_scale");

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingBand, setEditingBand] = useState<Band | null>(null);
  const [showNewBand, setShowNewBand] = useState(false);

  const { data: instrument } = useQuery({
    queryKey: ["admin-instrument", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments").select("*").eq("id", instrumentId!).single();
      if (error) throw error;
      return data as Instrument;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["admin-instrument-items", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data: itemRows, error } = await supabase
        .from("assessment_instrument_items").select("*")
        .eq("instrument_id", instrumentId!).order("sort_order");
      if (error) throw error;
      const ids = itemRows.map((r) => r.id);
      const { data: optRows } = ids.length
        ? await supabase.from("assessment_instrument_options").select("*")
            .in("item_id", ids).order("sort_order")
        : { data: [] as Option[] };
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
        .from("assessment_bands").select("*")
        .eq("instrument_id", instrumentId!).order("min_score");
      if (error) throw error;
      return data as Band[];
    },
  });

  const locked = instrument?.is_locked ?? false;

  const invItems = () => qc.invalidateQueries({ queryKey: ["admin-instrument-items", instrumentId] });
  const invBands = () => qc.invalidateQueries({ queryKey: ["admin-instrument-bands", instrumentId] });
  const invInst = () => qc.invalidateQueries({ queryKey: ["admin-instrument", instrumentId] });

  const updateInstrument = useMutation({
    mutationFn: async (patch: Partial<Instrument>) => {
      const { error } = await supabase.from("assessment_instruments")
        .update(patch).eq("id", instrumentId!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); invInst(); },
    onError: (e: any) => toast.error(e.message),
  });

  const auditLog = async (action: string) => {
    if (!user) return;
    await supabase.from("audit_log").insert({
      user_id: user.id, action, target_type: "assessment_instruments", target_id: instrumentId!,
    });
  };

  const validateForPublish = (): string | null => {
    if (!items || items.length === 0) return "Instrument needs at least one item before publishing.";
    for (const it of items) {
      if (OPTION_BASED.includes(it.item_type) && (!it.options || it.options.length < 2)) {
        return `Item "${it.prompt.slice(0, 40)}…" needs at least two options.`;
      }
      if (it.is_flag_item && it.flag_threshold == null) {
        return `Flag item "${it.prompt.slice(0, 40)}…" needs a flag threshold.`;
      }
    }
    if (bands && bands.length > 0) {
      const sorted = [...bands].sort((a, b) => a.min_score - b.min_score);
      const min = instrument?.min_score ?? sorted[0].min_score;
      const max = instrument?.max_score ?? sorted[sorted.length - 1].max_score;
      if (sorted[0].min_score > min) return `Bands leave a gap below ${sorted[0].min_score}.`;
      if (sorted[sorted.length - 1].max_score < max)
        return `Bands leave a gap above ${sorted[sorted.length - 1].max_score}.`;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].min_score > sorted[i - 1].max_score + 1)
          return `Bands leave a gap between ${sorted[i - 1].max_score} and ${sorted[i].min_score}.`;
      }
    }
    return null;
  };

  const setStatus = useMutation({
    mutationFn: async (status: "draft" | "published" | "archived") => {
      if (status === "published") {
        const err = validateForPublish();
        if (err) throw new Error(err);
      }
      const { error } = await supabase.from("assessment_instruments")
        .update({ status }).eq("id", instrumentId!);
      if (error) throw error;
      if (status === "published" || status === "archived") {
        await auditLog(status === "published" ? "publish_instrument" : "archive_instrument");
      }
    },
    onSuccess: () => { toast.success("Status updated"); invInst(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const nextOrder = (items?.length ?? 0) + 1;
      const { data: newItem, error } = await supabase
        .from("assessment_instrument_items").insert({
          instrument_id: instrumentId!,
          prompt: newItemPrompt.trim(),
          item_type: newItemType,
          sort_order: nextOrder,
        }).select().single();
      if (error) throw error;
      // Auto-seed Yes/No options
      if (newItemType === "yes_no" && newItem) {
        await supabase.from("assessment_instrument_options").insert([
          { item_id: newItem.id, label: "No", value: 0, sort_order: 1 },
          { item_id: newItem.id, label: "Yes", value: 1, sort_order: 2 },
        ]);
      }
    },
    onSuccess: () => {
      invItems();
      setShowNewItem(false);
      setNewItemPrompt("");
      setNewItemType("labeled_scale");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (patch: Partial<Item> & { id: string }) => {
      const { id, options, ...rest } = patch as any;
      const { error } = await supabase.from("assessment_instrument_items")
        .update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invItems(),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_instrument_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invItems(),
    onError: (e: any) => toast.error(e.message),
  });

  const swapItemOrder = useMutation({
    mutationFn: async ({ a, b }: { a: Item; b: Item }) => {
      // Two-step to avoid unique conflicts if a constraint exists
      const tmp = -Math.abs(a.sort_order) - 1000;
      await supabase.from("assessment_instrument_items").update({ sort_order: tmp }).eq("id", a.id);
      await supabase.from("assessment_instrument_items").update({ sort_order: a.sort_order }).eq("id", b.id);
      await supabase.from("assessment_instrument_items").update({ sort_order: b.sort_order }).eq("id", a.id);
    },
    onSuccess: () => invItems(),
    onError: (e: any) => toast.error(e.message),
  });

  const addOption = useMutation({
    mutationFn: async ({ itemId, label, value, sort_order }: { itemId: string; label: string; value: number; sort_order: number }) => {
      const { error } = await supabase.from("assessment_instrument_options")
        .insert({ item_id: itemId, label, value, sort_order });
      if (error) throw error;
    },
    onSuccess: () => invItems(),
    onError: (e: any) => toast.error(e.message),
  });

  const updateOption = useMutation({
    mutationFn: async (patch: { id: string; label?: string; value?: number; sort_order?: number }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("assessment_instrument_options").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invItems(),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_instrument_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invItems(),
    onError: (e: any) => toast.error(e.message),
  });

  const upsertBand = useMutation({
    mutationFn: async (band: Partial<Band> & { id?: string }) => {
      if (band.id) {
        const { id, ...rest } = band;
        const { error } = await supabase.from("assessment_bands").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assessment_bands").insert({
          instrument_id: instrumentId!,
          min_score: band.min_score!,
          max_score: band.max_score!,
          label: band.label!,
          severity: band.severity ?? "none",
          guidance: band.guidance ?? null,
          triggers_alert: band.triggers_alert ?? false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { invBands(); setEditingBand(null); setShowNewBand(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBand = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_bands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invBands(),
    onError: (e: any) => toast.error(e.message),
  });

  if (!instrument) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const publishError = instrument.status === "published" ? null : validateForPublish();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <Link to="/admin/content/instruments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Assessment Library
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{instrument.title}</h1>
            <Badge variant={instrument.source === "standard" ? "default" : "secondary"} className="text-xs">
              {instrument.source}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{instrument.status}</Badge>
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
        {!locked && (
          <div className="flex gap-2">
            {instrument.status !== "published" && (
              <Button
                size="sm"
                onClick={() => setStatus.mutate("published")}
                disabled={setStatus.isPending}
              >
                Publish
              </Button>
            )}
            {instrument.status === "published" && (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("archived")}>
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {!locked && publishError && instrument.status !== "published" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div><span className="font-medium">Not ready to publish:</span> {publishError}</div>
        </div>
      )}

      {/* Metadata */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Settings</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select value={instrument.status} disabled={locked}
                onValueChange={(v) => setStatus.mutate(v as any)}>
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
              <Select value={instrument.scoring_method} disabled={locked}
                onValueChange={(v) => updateInstrument.mutate({ scoring_method: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Min score</Label>
              <Input type="number" defaultValue={instrument.min_score ?? ""} disabled={locked}
                onBlur={(e) => updateInstrument.mutate({ min_score: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <Label>Max score</Label>
              <Input type="number" defaultValue={instrument.max_score ?? ""} disabled={locked}
                onBlur={(e) => updateInstrument.mutate({ max_score: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Checkbox id="hib" checked={instrument.higher_is_better} disabled={locked}
                onCheckedChange={(v) => updateInstrument.mutate({ higher_is_better: !!v })} />
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
              {items.map((it, idx) => {
                const needsOptions = OPTION_BASED.includes(it.item_type);
                const optionCount = it.options?.length ?? 0;
                const optionsInvalid = needsOptions && optionCount < 2;
                return (
                  <div key={it.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {idx + 1}. {it.prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{it.item_type}</Badge>
                          {it.is_required && <Badge variant="outline" className="text-xs">required</Badge>}
                          {it.is_flag_item && (
                            <Badge variant="destructive" className="text-xs">
                              safety flag ≥ {it.flag_threshold ?? "?"}
                            </Badge>
                          )}
                          {it.is_reverse_scored && (
                            <Badge variant="outline" className="text-xs">reverse-scored</Badge>
                          )}
                          {optionsInvalid && (
                            <Badge variant="destructive" className="text-xs">needs ≥ 2 options</Badge>
                          )}
                        </div>
                        {it.options && it.options.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {it.options.map((o) => `${o.label} (${o.value})`).join(" · ")}
                          </p>
                        )}
                      </div>
                      {!locked && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" disabled={idx === 0}
                            onClick={() => swapItemOrder.mutate({ a: it, b: items[idx - 1] })}>
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" disabled={idx === items.length - 1}
                            onClick={() => swapItemOrder.mutate({ a: it, b: items[idx + 1] })}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditingItem(it)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => { if (confirm("Delete this item?")) deleteItem.mutate(it.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bands */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Score bands ({bands?.length ?? 0})</h2>
            {!locked && (
              <Button size="sm" onClick={() => setShowNewBand(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add band
              </Button>
            )}
          </div>
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
                      {!locked && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setEditingBand(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => { if (confirm("Delete this band?")) deleteBand.mutate(b.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
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

      {/* New item dialog */}
      <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
            <DialogDescription>Create the prompt now; add options after.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Prompt</Label>
              <Textarea value={newItemPrompt} onChange={(e) => setNewItemPrompt(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Item type</Label>
              <Select value={newItemType} onValueChange={(v) => setNewItemType(v as ItemType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labeled_scale">Labeled scale</SelectItem>
                  <SelectItem value="single_select">Single select</SelectItem>
                  <SelectItem value="multi_select">Multi select</SelectItem>
                  <SelectItem value="yes_no">Yes / No (auto-seeds options)</SelectItem>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="free_text">Free text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItem(false)}>Cancel</Button>
            <Button disabled={!newItemPrompt.trim() || addItem.isPending} onClick={() => addItem.mutate()}>
              <Save className="h-4 w-4 mr-1" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      {editingItem && (
        <EditItemDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaveItem={(patch) => updateItem.mutate({ id: editingItem.id, ...patch })}
          onAddOption={(o) => addOption.mutate({ itemId: editingItem.id, ...o })}
          onUpdateOption={(o) => updateOption.mutate(o)}
          onDeleteOption={(id) => deleteOption.mutate(id)}
        />
      )}

      {/* Band editor */}
      {(showNewBand || editingBand) && (
        <BandDialog
          band={editingBand}
          onClose={() => { setEditingBand(null); setShowNewBand(false); }}
          onSave={(b) => upsertBand.mutate(b)}
        />
      )}
    </div>
  );
};

// ---------------- Item edit dialog with options editor ----------------

function EditItemDialog({
  item, onClose, onSaveItem, onAddOption, onUpdateOption, onDeleteOption,
}: {
  item: Item;
  onClose: () => void;
  onSaveItem: (patch: Partial<Item>) => void;
  onAddOption: (o: { label: string; value: number; sort_order: number }) => void;
  onUpdateOption: (o: { id: string; label?: string; value?: number; sort_order?: number }) => void;
  onDeleteOption: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState(item.prompt);
  const [itemType, setItemType] = useState<ItemType>(item.item_type);
  const [isRequired, setIsRequired] = useState(item.is_required);
  const [isReverse, setIsReverse] = useState(item.is_reverse_scored);
  const [isFlag, setIsFlag] = useState(item.is_flag_item);
  const [flagThreshold, setFlagThreshold] = useState<string>(item.flag_threshold?.toString() ?? "");

  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState<string>("");

  const showsOptions = OPTION_BASED.includes(itemType);
  const options = item.options ?? [];

  const save = () => {
    onSaveItem({
      prompt: prompt.trim(),
      item_type: itemType,
      is_required: isRequired,
      is_reverse_scored: isReverse,
      is_flag_item: isFlag,
      flag_threshold: isFlag && flagThreshold !== "" ? Number(flagThreshold) : null,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Item type</Label>
            <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch id="req" checked={isRequired} onCheckedChange={setIsRequired} />
              <Label htmlFor="req" className="cursor-pointer">Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rev" checked={isReverse} onCheckedChange={setIsReverse} />
              <Label htmlFor="rev" className="cursor-pointer">Reverse-scored</Label>
            </div>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Switch id="flag" checked={isFlag} onCheckedChange={setIsFlag} />
              <Label htmlFor="flag" className="cursor-pointer">
                Safety-flag item (triggers peer/admin alert, e.g. self-harm)
              </Label>
            </div>
            {isFlag && (
              <div>
                <Label>Flag threshold (numeric value at or above which the response is flagged)</Label>
                <Input type="number" value={flagThreshold}
                  onChange={(e) => setFlagThreshold(e.target.value)} />
              </div>
            )}
          </div>

          {showsOptions && (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <h3 className="font-medium text-sm">Answer options</h3>
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">No options yet — add at least two.</p>
              )}
              {options.map((o, idx) => (
                <div key={o.id} className="grid grid-cols-[1fr,90px,auto,auto] gap-2 items-center">
                  <Input defaultValue={o.label} placeholder="Label"
                    onBlur={(e) => e.target.value !== o.label && onUpdateOption({ id: o.id, label: e.target.value })} />
                  <Input type="number" defaultValue={o.value} placeholder="Value"
                    onBlur={(e) => Number(e.target.value) !== o.value && onUpdateOption({ id: o.id, value: Number(e.target.value) })} />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" disabled={idx === 0}
                      onClick={() => {
                        const prev = options[idx - 1];
                        onUpdateOption({ id: o.id, sort_order: prev.sort_order });
                        onUpdateOption({ id: prev.id, sort_order: o.sort_order });
                      }}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={idx === options.length - 1}
                      onClick={() => {
                        const next = options[idx + 1];
                        onUpdateOption({ id: o.id, sort_order: next.sort_order });
                        onUpdateOption({ id: next.id, sort_order: o.sort_order });
                      }}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteOption(o.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="grid grid-cols-[1fr,90px,auto] gap-2 items-center pt-2 border-t border-border">
                <Input placeholder="New option label" value={newOptLabel}
                  onChange={(e) => setNewOptLabel(e.target.value)} />
                <Input type="number" placeholder="Value" value={newOptValue}
                  onChange={(e) => setNewOptValue(e.target.value)} />
                <Button
                  size="sm"
                  disabled={!newOptLabel.trim() || newOptValue === ""}
                  onClick={() => {
                    onAddOption({
                      label: newOptLabel.trim(),
                      value: Number(newOptValue),
                      sort_order: (options[options.length - 1]?.sort_order ?? 0) + 1,
                    });
                    setNewOptLabel("");
                    setNewOptValue("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!prompt.trim()}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Band dialog ----------------

function BandDialog({
  band, onClose, onSave,
}: {
  band: Band | null;
  onClose: () => void;
  onSave: (b: Partial<Band> & { id?: string }) => void;
}) {
  const [minScore, setMinScore] = useState<string>(band?.min_score?.toString() ?? "");
  const [maxScore, setMaxScore] = useState<string>(band?.max_score?.toString() ?? "");
  const [label, setLabel] = useState(band?.label ?? "");
  const [severity, setSeverity] = useState<Band["severity"]>(band?.severity ?? "none");
  const [guidance, setGuidance] = useState(band?.guidance ?? "");
  const [triggersAlert, setTriggersAlert] = useState(band?.triggers_alert ?? false);

  const valid =
    minScore !== "" && maxScore !== "" && Number(maxScore) >= Number(minScore) && label.trim().length > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{band ? "Edit band" : "Add band"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min score</Label>
              <Input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
            </div>
            <div>
              <Label>Max score</Label>
              <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Moderate" />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Band["severity"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Guidance</Label>
            <Textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="alert" checked={triggersAlert} onCheckedChange={setTriggersAlert} />
            <Label htmlFor="alert" className="cursor-pointer">Triggers alert to peer/admin</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => onSave({
              id: band?.id,
              min_score: Number(minScore),
              max_score: Number(maxScore),
              label: label.trim(),
              severity,
              guidance: guidance.trim() || null,
              triggers_alert: triggersAlert,
            })}
          >
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AdminAssessmentInstrumentDetailPage;
