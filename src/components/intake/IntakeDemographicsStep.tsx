import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const PNTS = "__pnts__";

interface Props {
  participantId: string;
  onCompleted: () => void;
}

interface Fields {
  race_ethnicity: string;
  gender: string;
  primary_language: string;
  sexual_orientation_gender_identity: string;
}

const EMPTY: Fields = {
  race_ethnicity: "",
  gender: "",
  primary_language: "",
  sexual_orientation_gender_identity: "",
};

const FIELD_LABELS: Record<keyof Fields, string> = {
  race_ethnicity: "Race / ethnicity",
  gender: "Gender",
  primary_language: "Primary language",
  sexual_orientation_gender_identity: "Sexual orientation / gender identity",
};

export function IntakeDemographicsStep({ participantId, onCompleted }: Props) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [pnts, setPnts] = useState<Record<keyof Fields, boolean>>({
    race_ethnicity: false,
    gender: false,
    primary_language: false,
    sexual_orientation_gender_identity: false,
  });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["participant-demographics", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_demographics")
        .select("*")
        .eq("participant_id", participantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    const next: Fields = { ...EMPTY };
    const nextPnts = {
      race_ethnicity: false,
      gender: false,
      primary_language: false,
      sexual_orientation_gender_identity: false,
    };
    (Object.keys(FIELD_LABELS) as (keyof Fields)[]).forEach((k) => {
      const v = (data as any)[k] as string | null;
      if (v === PNTS) {
        nextPnts[k] = true;
      } else if (v) {
        next[k] = v;
      }
    });
    setFields(next);
    setPnts(nextPnts);
  }, [data]);

  const togglePnts = (k: keyof Fields) => {
    setPnts((p) => ({ ...p, [k]: !p[k] }));
    if (!pnts[k]) setFields((f) => ({ ...f, [k]: "" }));
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      const payload: any = { participant_id: participantId };
      (Object.keys(FIELD_LABELS) as (keyof Fields)[]).forEach((k) => {
        if (pnts[k]) payload[k] = PNTS;
        else payload[k] = fields[k].trim() || null;
      });
      const { error } = await supabase
        .from("participant_demographics")
        .upsert(payload, { onConflict: "participant_id" });
      if (error) throw error;
      onCompleted();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Demographics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These questions are optional and used for program reporting only.
          Every item can be skipped with "Prefer not to say."
        </p>
      </div>

      <div className="space-y-5">
        {(Object.keys(FIELD_LABELS) as (keyof Fields)[]).map((k) => (
          <div key={k} className="space-y-2">
            <Label>{FIELD_LABELS[k]}</Label>
            <Input
              value={fields[k]}
              onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
              disabled={pnts[k]}
              placeholder={pnts[k] ? "Prefer not to say" : "Optional"}
            />
            <button
              type="button"
              onClick={() => togglePnts(k)}
              className={`text-xs underline underline-offset-2 ${
                pnts[k] ? "text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {pnts[k] ? "✓ Prefer not to say (tap to undo)" : "Prefer not to say"}
            </button>
          </div>
        ))}
      </div>

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
