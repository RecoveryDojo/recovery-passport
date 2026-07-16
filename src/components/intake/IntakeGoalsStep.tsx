import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  onCompleted: () => void;
}

export function IntakeGoalsStep({ sessionId, onCompleted }: Props) {
  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [g3, setG3] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["intake-session-goals", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_sessions")
        .select("goal_1, goal_2, goal_3")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setG1(data.goal_1 ?? "");
      setG2(data.goal_2 ?? "");
      setG3(data.goal_3 ?? "");
    }
  }, [data]);

  const handleContinue = async () => {
    if (!g1.trim() || !g2.trim() || !g3.trim()) {
      toast.error("Please enter all three goals");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("intake_sessions")
      .update({ goal_1: g1.trim(), goal_2: g2.trim(), goal_3: g3.trim() })
      .eq("id", sessionId);
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
        <h2 className="text-xl font-semibold text-primary">Three Goals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ask the participant for three goals or personal priorities to record for
          this intake. These are recorded comments — they are not part of a recovery
          plan.
        </p>
      </div>

      {[
        { n: 1, value: g1, set: setG1 },
        { n: 2, value: g2, set: setG2 },
        { n: 3, value: g3, set: setG3 },
      ].map(({ n, value, set }) => (
        <div key={n} className="space-y-1.5">
          <Label htmlFor={`goal-${n}`}>Goal or personal priority {n}</Label>
          <Textarea
            id={`goal-${n}`}
            value={value}
            onChange={(e) => set(e.target.value)}
            rows={2}
            placeholder="In the participant's own words…"
          />
        </div>
      ))}

      <Button
        onClick={handleContinue}
        disabled={saving}
        className="w-full min-h-[52px]"
      >
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
