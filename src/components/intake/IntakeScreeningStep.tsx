import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type UaResult = Database["public"]["Enums"]["ua_result"];

interface Panel {
  key: string;
  id?: string;
  panel_name: string;
  result: UaResult | "";
}

interface Props {
  sessionId: string;
  staffUserId: string;
  onCompleted: () => void;
}

export function IntakeScreeningStep({ sessionId, staffUserId, onCompleted }: Props) {
  const [breath, setBreath] = useState("");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["intake-screening", sessionId],
    queryFn: async () => {
      const { data: sr } = await supabase
        .from("intake_screening_results")
        .select("id, breathalyzer_result")
        .eq("intake_session_id", sessionId)
        .maybeSingle();
      if (!sr) return { screening: null, panels: [] };
      const { data: ps } = await supabase
        .from("intake_ua_panels")
        .select("id, panel_name, result")
        .eq("screening_result_id", sr.id);
      return { screening: sr, panels: ps ?? [] };
    },
  });

  useEffect(() => {
    if (!data) return;
    setBreath(data.screening?.breathalyzer_result?.toString() ?? "");
    setPanels(
      (data.panels ?? []).map((p) => ({
        key: p.id,
        id: p.id,
        panel_name: p.panel_name,
        result: p.result as UaResult,
      })),
    );
  }, [data]);

  const addPanel = () =>
    setPanels((p) => [...p, { key: crypto.randomUUID(), panel_name: "", result: "" }]);
  const removePanel = (key: string) => setPanels((p) => p.filter((r) => r.key !== key));
  const updatePanel = (key: string, patch: Partial<Panel>) =>
    setPanels((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleContinue = async () => {
    for (const p of panels) {
      if (!p.panel_name.trim() || !p.result) {
        toast.error("Complete every panel or remove it");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        intake_session_id: sessionId,
        breathalyzer_result: breath.trim() ? Number(breath) : null,
        administered_by: staffUserId,
      };
      const { data: upserted, error } = await supabase
        .from("intake_screening_results")
        .upsert(payload, { onConflict: "intake_session_id" })
        .select("id")
        .single();
      if (error) throw error;

      // Replace panels wholesale
      await supabase.from("intake_ua_panels").delete().eq("screening_result_id", upserted.id);
      if (panels.length) {
        const { error: pErr } = await supabase.from("intake_ua_panels").insert(
          panels.map((p) => ({
            screening_result_id: upserted.id,
            panel_name: p.panel_name.trim(),
            result: p.result as UaResult,
          })),
        );
        if (pErr) throw pErr;
      }
      onCompleted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-primary">Screening</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Record admission screening results. Administered by you.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="breath">Breathalyzer result</Label>
        <Input
          id="breath"
          type="number"
          step="0.001"
          inputMode="decimal"
          value={breath}
          onChange={(e) => setBreath(e.target.value)}
          placeholder="e.g. 0.000"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>UA panels</Label>
          <Button size="sm" variant="outline" onClick={addPanel}>
            <Plus className="h-4 w-4 mr-1" /> Add panel
          </Button>
        </div>
        {panels.length === 0 && (
          <p className="text-xs text-muted-foreground">No panels recorded.</p>
        )}
        {panels.map((p) => (
          <Card key={p.key} className="p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={p.panel_name}
                onChange={(e) => updatePanel(p.key, { panel_name: e.target.value })}
                placeholder="Panel name (e.g. Opiates)"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removePanel(p.key)}
                aria-label="Remove panel"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <RadioGroup
              value={p.result}
              onValueChange={(v) => updatePanel(p.key, { result: v as UaResult })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="pass" /> Pass
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="fail" /> Fail
              </label>
            </RadioGroup>
          </Card>
        ))}
      </div>

      <Button onClick={handleContinue} disabled={saving} className="w-full min-h-[52px]">
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
