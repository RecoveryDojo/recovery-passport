import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Building2, MapPin, Phone } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";

type Program = Tables<"programs">;
type ProgramType = (typeof Constants.public.Enums.program_type)[number];

const programTypeLabels: Record<ProgramType, string> = {
  respite_house: "Respite House",
  sober_living: "Sober Living",
  treatment: "Treatment",
  outpatient: "Outpatient",
};

const emptyForm = {
  name: "",
  type: "respite_house" as ProgramType,
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
};

const AdminProgramsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: programs, isLoading } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Program[];
    },
  });

  // Check which programs have participants
  const { data: programsWithParticipants } = useQuery({
    queryKey: ["programs-participant-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("current_program_id")
        .not("current_program_id", "is", null);
      if (error) throw error;
      const ids = new Set(data?.map((p) => p.current_program_id));
      return ids;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingProgram) {
        const { error } = await supabase
          .from("programs")
          .update({
            name: form.name,
            type: form.type,
            address: form.address || null,
            city: form.city || null,
            state: form.state || null,
            zip: form.zip || null,
            phone: form.phone || null,
          })
          .eq("id", editingProgram.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("programs").insert({
          name: form.name,
          type: form.type,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          phone: form.phone || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
      toast({ title: editingProgram ? "Program updated" : "Program created" });
      closeDialog();
    },
    onError: (e) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingProgram(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (program: Program) => {
    setEditingProgram(program);
    setForm({
      name: program.name,
      type: program.type as ProgramType,
      address: program.address || "",
      city: program.city || "",
      state: program.state || "",
      zip: program.zip || "",
      phone: program.phone || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProgram(null);
    setForm(emptyForm);
  };

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Programs</h1>
          <p className="text-sm text-muted-foreground">Manage recovery programs</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Program
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : programs?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No programs yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {programs?.map((program) => (
            <Card key={program.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{program.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {programTypeLabels[program.type as ProgramType] || program.type}
                        </Badge>
                      </div>
                      {(program.address || program.city) && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[program.address, program.city, program.state, program.zip]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      {program.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {program.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(program)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProgram ? "Edit Program" : "Add Program"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Program name" />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.program_type.map((t) => (
                    <SelectItem key={t} value={t}>
                      {programTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setField("state", e.target.value)} maxLength={2} />
              </div>
              <div>
                <Label>ZIP</Label>
                <Input value={form.zip} onChange={(e) => setField("zip", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
            >
              {editingProgram ? "Save Changes" : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProgramsPage;
