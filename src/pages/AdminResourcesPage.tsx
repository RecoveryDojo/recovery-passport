import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { Plus, Check, X, AlertTriangle, Pencil, Undo2 } from "lucide-react";

const TYPE_OPTIONS = [
  "housing", "food", "employment", "legal", "mental_health",
  "medical", "transportation", "education", "benefits", "other",
];

const FILTER_OPTIONS = ["All", "Approved", "Pending Approval", "Stale"];

const TYPE_COLORS: Record<string, string> = {
  housing: "bg-blue-100 text-blue-700",
  food: "bg-green-100 text-green-700",
  employment: "bg-purple-100 text-purple-700",
  legal: "bg-amber-100 text-amber-700",
  mental_health: "bg-pink-100 text-pink-700",
  medical: "bg-red-100 text-red-700",
  transportation: "bg-cyan-100 text-cyan-700",
  education: "bg-indigo-100 text-indigo-700",
  benefits: "bg-orange-100 text-orange-700",
  other: "bg-muted text-muted-foreground",
};

interface PartnerForm {
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  description: string;
  services_offered: string;
  availability_status: string;
  logo_url: string;
}

const emptyForm: PartnerForm = {
  name: "", type: "other", address: "", city: "", state: "", zip: "",
  phone: "", website: "", description: "", services_offered: "",
  availability_status: "", logo_url: "",
};

const AdminResourcesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);

  const writeAudit = async (action: string, targetId: string, metadata: Record<string, any> = {}) => {
    if (!user) return;
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action,
      target_type: "community_partners",
      target_id: targetId,
      metadata: metadata as any,
    });
  };

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["admin-community-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_partners")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = partners.filter((p) => {
    const stale = differenceInDays(new Date(), new Date(p.last_updated_at)) > 30;
    if (filter === "Approved") return p.is_approved;
    if (filter === "Pending Approval") return !p.is_approved;
    if (filter === "Stale") return stale;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        description: form.description.trim() || null,
        services_offered: form.services_offered.split(",").map((s) => s.trim()).filter(Boolean),
        availability_status: form.availability_status.trim() || null,
        logo_url: form.logo_url.trim() || null,
        last_updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from("community_partners").update(payload).eq("id", editingId);
        if (error) throw error;
        await writeAudit("edit_community_partner", editingId, { name: payload.name });
        return editingId;
      } else {
        const { data, error } = await supabase.from("community_partners").insert({
          ...payload,
          submitted_by: user!.id,
          is_approved: true,
        }).select("id").single();
        if (error) throw error;
        await writeAudit("add_community_partner", data.id, { name: payload.name });
        return data.id;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Resource updated" : "Resource added");
      queryClient.invalidateQueries({ queryKey: ["admin-community-partners"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Failed to save"),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approve, name }: { id: string; approve: boolean; name: string }) => {
      const { error } = await supabase
        .from("community_partners")
        .update({ is_approved: approve, last_updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await writeAudit(approve ? "approve_community_partner" : "unapprove_community_partner", id, { name });
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Resource approved" : "Resource unapproved");
      queryClient.invalidateQueries({ queryKey: ["admin-community-partners"] });
    },
    onError: () => toast.error("Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await writeAudit("remove_community_partner", id, { name });
      const { error } = await supabase.from("community_partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resource removed");
      queryClient.invalidateQueries({ queryKey: ["admin-community-partners"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type ?? "other",
      address: p.address ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      zip: p.zip ?? "",
      phone: p.phone ?? "",
      website: p.website ?? "",
      description: p.description ?? "",
      services_offered: (p.services_offered ?? []).join(", "),
      availability_status: p.availability_status ?? "",
      logo_url: p.logo_url ?? "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const updateField = (field: keyof PartnerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const confirmRemove = (p: any) => {
    if (window.confirm(`Remove "${p.name}"? This cannot be undone.`)) {
      deleteMutation.mutate({ id: p.id, name: p.name });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Resource Directory</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1" /> Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Resource" : "Add Resource"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Name *" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
              <Select value={form.type} onValueChange={(v) => updateField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Address" value={form.address} onChange={(e) => updateField("address", e.target.value)} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="City" value={form.city} onChange={(e) => updateField("city", e.target.value)} />
                <Input placeholder="State" value={form.state} onChange={(e) => updateField("state", e.target.value)} />
                <Input placeholder="ZIP" value={form.zip} onChange={(e) => updateField("zip", e.target.value)} />
              </div>
              <Input placeholder="Phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              <Input placeholder="Website" value={form.website} onChange={(e) => updateField("website", e.target.value)} />
              <Textarea placeholder="Description" value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={3} />
              <Input placeholder="Services (comma-separated)" value={form.services_offered} onChange={(e) => updateField("services_offered", e.target.value)} />
              <Input placeholder="Availability status (e.g. '2 beds available')" value={form.availability_status} onChange={(e) => updateField("availability_status", e.target.value)} />
              <Input placeholder="Logo image URL" value={form.logo_url} onChange={(e) => updateField("logo_url", e.target.value)} />
              <Button className="w-full bg-primary hover:bg-primary/90" disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "Saving…" : editingId ? "Update" : "Add Resource"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No resources match this filter.</div>
      ) : (
        filtered.map((p) => {
          const typeColor = TYPE_COLORS[p.type ?? "other"] ?? TYPE_COLORS.other;
          const typeLabel = (p.type ?? "other").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const daysOld = differenceInDays(new Date(), new Date(p.last_updated_at));
          const isStale = daysOld > 30;

          return (
            <div key={p.id} className={`bg-card border rounded-xl p-4 space-y-2 ${!p.is_approved ? "opacity-70" : ""} ${isStale ? "border-amber-300" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge className={`${typeColor} border-0 text-[10px]`}>{typeLabel}</Badge>
                    {p.is_approved ? (
                      <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Approved</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Pending</Badge>
                    )}
                    {isStale && (
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Stale · {daysOld}d
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {p.is_approved ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Unapprove" onClick={() => approveMutation.mutate({ id: p.id, approve: false, name: p.name })}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Approve" onClick={() => approveMutation.mutate({ id: p.id, approve: true, name: p.name })}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Remove" onClick={() => confirmRemove(p)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {p.description && <p className="text-xs text-foreground/80">{p.description}</p>}
              {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
              {[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") && (
                <p className="text-xs text-muted-foreground">{[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p>
              )}
              <p className="text-[10px] text-muted-foreground">Last updated {daysOld}d ago</p>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AdminResourcesPage;
