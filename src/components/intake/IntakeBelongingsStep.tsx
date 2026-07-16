import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  staffUserId: string;
  onCompleted: () => void;
}

export function IntakeBelongingsStep({ sessionId, staffUserId, onCompleted }: Props) {
  const [items, setItems] = useState("");
  const [prohibited, setProhibited] = useState<"yes" | "no">("no");
  const [prohibitedNotes, setProhibitedNotes] = useState("");
  const [dryer, setDryer] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["intake-belongings", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("intake_belongings_log")
        .select("items_summary, prohibited_items_found, prohibited_items_notes, dryer_treatment_completed")
        .eq("intake_session_id", sessionId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setItems(data.items_summary ?? "");
    setProhibited(data.prohibited_items_found ? "yes" : "no");
    setProhibitedNotes(data.prohibited_items_notes ?? "");
    setDryer(!!data.dryer_treatment_completed);
  }, [data]);

  const handleContinue = async () => {
    setSaving(true);
    const { error } = await supabase.from("intake_belongings_log").upsert(
      {
        intake_session_id: sessionId,
        items_summary: items.trim() || null,
        prohibited_items_found: prohibited === "yes",
        prohibited_items_notes: prohibited === "yes" ? prohibitedNotes.trim() || null : null,
        dryer_treatment_completed: dryer,
        searched_by: staffUserId,
      },
      { onConflict: "intake_session_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onCompleted();
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
        <h2 className="text-xl font-semibold text-primary">Belongings Search</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Record what was inventoried during belongings intake.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="items">Items summary</Label>
        <Textarea
          id="items"
          value={items}
          onChange={(e) => setItems(e.target.value)}
          rows={3}
          placeholder="Brief description of belongings…"
        />
      </div>

      <div className="space-y-2">
        <Label>Prohibited items found?</Label>
        <RadioGroup value={prohibited} onValueChange={(v) => setProhibited(v as "yes" | "no")} className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="no" /> No
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="yes" /> Yes
          </label>
        </RadioGroup>
        {prohibited === "yes" && (
          <Textarea
            value={prohibitedNotes}
            onChange={(e) => setProhibitedNotes(e.target.value)}
            rows={2}
            placeholder="Notes on prohibited items…"
          />
        )}
      </div>

      <label className="flex items-start gap-3">
        <Checkbox checked={dryer} onCheckedChange={(v) => setDryer(!!v)} />
        <span className="text-sm">Dryer treatment completed (bedbug/lice prevention)</span>
      </label>

      <Button onClick={handleContinue} disabled={saving} className="w-full min-h-[52px]">
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
