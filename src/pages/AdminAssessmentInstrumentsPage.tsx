import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Lock, Plus } from "lucide-react";

type Instrument = {
  id: string;
  title: string;
  description: string | null;
  source: "standard" | "custom";
  is_locked: boolean;
  status: "draft" | "published" | "archived";
  higher_is_better: boolean;
  min_score: number | null;
  max_score: number | null;
};

const AdminAssessmentInstrumentsPage = () => {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: instruments, isLoading } = useQuery({
    queryKey: ["admin-instruments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments")
        .select("id, title, description, source, is_locked, status, higher_is_better, min_score, max_score")
        .order("source", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return data as Instrument[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assessment_instruments").insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        source: "custom" as const,
        is_locked: false,
        status: "draft" as const,
        scoring_method: "sum" as const,
        higher_is_better: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instrument created");
      qc.invalidateQueries({ queryKey: ["admin-instruments"] });
      setShowNew(false);
      setNewTitle("");
      setNewDesc("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <Link
        to="/admin/content"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Content Hub
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assessment Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Standard instruments (PHQ-9, GAD-7) are locked. Create custom instruments for your program.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New instrument
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !instruments || instruments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No instruments yet.</p>
      ) : (
        <div className="grid gap-3">
          {instruments.map((inst) => (
            <Link key={inst.id} to={`/admin/content/instruments/${inst.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{inst.title}</p>
                      <Badge variant={inst.source === "standard" ? "default" : "secondary"} className="text-xs">
                        {inst.source}
                      </Badge>
                      {inst.is_locked && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="h-3 w-3" /> locked
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs capitalize">
                        {inst.status}
                      </Badge>
                    </div>
                    {inst.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {inst.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Range {inst.min_score ?? "—"}–{inst.max_score ?? "—"} · higher = {inst.higher_is_better ? "better" : "worse"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New custom instrument</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-title">Title</Label>
              <Input id="new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Housing Stability Screener" />
            </div>
            <div>
              <Label htmlFor="new-desc">Description</Label>
              <Textarea id="new-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">
              Created as a draft. Add items, options, and score bands on the next screen before publishing.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAssessmentInstrumentsPage;
