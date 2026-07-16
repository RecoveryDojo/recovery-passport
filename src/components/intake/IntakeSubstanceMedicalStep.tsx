import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Frequency = Database["public"]["Enums"]["substance_frequency"];

const SUBSTANCE_OPTIONS = [
  "Alcohol",
  "Opioids",
  "Stimulants",
  "Cannabis",
  "Benzodiazepines",
  "Other",
] as const;

interface Substance {
  key: string; // client-side row key
  substance_choice: string;
  substance_other: string;
  frequency_of_use: Frequency | "";
  route_of_use: string;
  age_of_first_use: string;
  last_use_date: string;
  prior_treatment_attempts: string;
}

const emptyRow = (): Substance => ({
  key: crypto.randomUUID(),
  substance_choice: "",
  substance_other: "",
  frequency_of_use: "",
  route_of_use: "",
  age_of_first_use: "",
  last_use_date: "",
  prior_treatment_attempts: "",
});

interface Props {
  sessionId: string;
  onCompleted: () => void;
}

export function IntakeSubstanceMedicalStep({ sessionId, onCompleted }: Props) {
  const [rows, setRows] = useState<Substance[]>([emptyRow()]);
  const [medicalConcerns, setMedicalConcerns] = useState("");
  const [hospitalized, setHospitalized] = useState<"yes" | "no">("no");
  const [priorPathways, setPriorPathways] = useState("");
  const [needsDocs, setNeedsDocs] = useState<"yes" | "no">("no");
  const [docsNotes, setDocsNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["intake-substance-medical", sessionId],
    queryFn: async () => {
      const [subs, clinical] = await Promise.all([
        supabase
          .from("intake_substance_use")
          .select("*")
          .eq("intake_session_id", sessionId)
          .order("created_at"),
        supabase
          .from("intake_clinical_details")
          .select("*")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
      ]);
      if (subs.error) throw subs.error;
      if (clinical.error) throw clinical.error;
      return { subs: subs.data ?? [], clinical: clinical.data };
    },
  });

  useEffect(() => {
    if (!data) return;
    if (data.subs.length > 0) {
      setRows(
        data.subs.map((s) => {
          const isKnown = (SUBSTANCE_OPTIONS as readonly string[]).includes(
            s.substance_name
          );
          return {
            key: s.id,
            substance_choice: isKnown ? s.substance_name : "Other",
            substance_other: isKnown ? "" : s.substance_name,
            frequency_of_use: s.frequency_of_use,
            route_of_use: s.route_of_use ?? "",
            age_of_first_use:
              s.age_of_first_use != null ? String(s.age_of_first_use) : "",
            last_use_date: s.last_use_date ?? "",
            prior_treatment_attempts:
              s.prior_treatment_attempts != null
                ? String(s.prior_treatment_attempts)
                : "",
          };
        })
      );
    }
    if (data.clinical) {
      setMedicalConcerns(data.clinical.medical_concerns ?? "");
      setHospitalized(data.clinical.hospitalized_last_90_days ? "yes" : "no");
      setPriorPathways(data.clinical.prior_pathways ?? "");
      setNeedsDocs(data.clinical.needs_vital_docs ? "yes" : "no");
      setDocsNotes(data.clinical.vital_docs_notes ?? "");
    }
  }, [data]);

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (key: string) =>
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.key !== key)));
  const updateRow = (key: string, patch: Partial<Substance>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const handleContinue = async () => {
    // Validate: rows that have any content must have name + frequency
    const filled = rows.filter((r) => r.substance_choice || r.substance_other);
    for (const r of filled) {
      const name =
        r.substance_choice === "Other" ? r.substance_other.trim() : r.substance_choice;
      if (!name) {
        toast.error("Enter a substance name or remove the row");
        return;
      }
      if (!r.frequency_of_use) {
        toast.error(`Select frequency for ${name}`);
        return;
      }
    }

    setSaving(true);
    try {
      // Replace substance rows for this session
      const { error: delErr } = await supabase
        .from("intake_substance_use")
        .delete()
        .eq("intake_session_id", sessionId);
      if (delErr) throw delErr;

      if (filled.length > 0) {
        const insertRows = filled.map((r) => ({
          intake_session_id: sessionId,
          substance_name:
            r.substance_choice === "Other"
              ? r.substance_other.trim()
              : r.substance_choice,
          frequency_of_use: r.frequency_of_use as Frequency,
          route_of_use: r.route_of_use.trim() || null,
          age_of_first_use: r.age_of_first_use
            ? parseInt(r.age_of_first_use, 10)
            : null,
          last_use_date: r.last_use_date || null,
          prior_treatment_attempts: r.prior_treatment_attempts
            ? parseInt(r.prior_treatment_attempts, 10)
            : null,
        }));
        const { error: insErr } = await supabase
          .from("intake_substance_use")
          .insert(insertRows);
        if (insErr) throw insErr;
      }

      const clinicalPayload = {
        intake_session_id: sessionId,
        medical_concerns: medicalConcerns.trim() || null,
        hospitalized_last_90_days: hospitalized === "yes",
        prior_pathways: priorPathways.trim() || null,
        needs_vital_docs: needsDocs === "yes",
        vital_docs_notes: docsNotes.trim() || null,
      };
      const { error: upErr } = await supabase
        .from("intake_clinical_details")
        .upsert(clinicalPayload, { onConflict: "intake_session_id" });
      if (upErr) throw upErr;

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
        <h2 className="text-xl font-semibold text-primary">
          Substance History & Medical
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add each substance the participant reports. You can add as many as
          apply.
        </p>
      </div>

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <Card key={row.key} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Substance {idx + 1}
              </p>
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  className="text-destructive hover:text-destructive h-8 px-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Substance</Label>
              <Select
                value={row.substance_choice}
                onValueChange={(v) => updateRow(row.key, { substance_choice: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a substance" />
                </SelectTrigger>
                <SelectContent>
                  {SUBSTANCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {row.substance_choice === "Other" && (
                <Input
                  placeholder="Specify substance"
                  value={row.substance_other}
                  onChange={(e) =>
                    updateRow(row.key, { substance_other: e.target.value })
                  }
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Frequency of use</Label>
              <Select
                value={row.frequency_of_use}
                onValueChange={(v) =>
                  updateRow(row.key, { frequency_of_use: v as Frequency })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="occasional">Occasional</SelectItem>
                  <SelectItem value="not_in_use">Not in use</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Route of use</Label>
                <Input
                  value={row.route_of_use}
                  onChange={(e) =>
                    updateRow(row.key, { route_of_use: e.target.value })
                  }
                  placeholder="e.g. oral, IV"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Age of first use</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.age_of_first_use}
                  onChange={(e) =>
                    updateRow(row.key, { age_of_first_use: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date of last use</Label>
                <Input
                  type="date"
                  value={row.last_use_date}
                  onChange={(e) =>
                    updateRow(row.key, { last_use_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prior treatment attempts</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.prior_treatment_attempts}
                  onChange={(e) =>
                    updateRow(row.key, {
                      prior_treatment_attempts: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </Card>
        ))}

        <Button
          variant="outline"
          onClick={addRow}
          className="w-full min-h-[48px]"
        >
          <Plus className="mr-2 h-4 w-4" /> Add substance
        </Button>
      </div>

      <div className="space-y-4 pt-2">
        <h3 className="text-base font-semibold text-primary">Medical</h3>

        <div className="space-y-1.5">
          <Label>Medical concerns</Label>
          <Textarea
            value={medicalConcerns}
            onChange={(e) => setMedicalConcerns(e.target.value)}
            rows={3}
            placeholder="Chronic conditions, medications, allergies…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Hospitalized in last 90 days?</Label>
          <RadioGroup
            value={hospitalized}
            onValueChange={(v) => setHospitalized(v as "yes" | "no")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="yes" id="hosp-yes" />
              <Label htmlFor="hosp-yes" className="font-normal">Yes</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id="hosp-no" />
              <Label htmlFor="hosp-no" className="font-normal">No</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label>Prior recovery pathways tried</Label>
          <Textarea
            value={priorPathways}
            onChange={(e) => setPriorPathways(e.target.value)}
            rows={3}
            placeholder="e.g. 12-step, MAT, faith-based, SMART Recovery…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Needs help obtaining vital documents?</Label>
          <RadioGroup
            value={needsDocs}
            onValueChange={(v) => setNeedsDocs(v as "yes" | "no")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="yes" id="docs-yes" />
              <Label htmlFor="docs-yes" className="font-normal">Yes</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id="docs-no" />
              <Label htmlFor="docs-no" className="font-normal">No</Label>
            </div>
          </RadioGroup>
          {needsDocs === "yes" && (
            <Textarea
              value={docsNotes}
              onChange={(e) => setDocsNotes(e.target.value)}
              rows={2}
              placeholder="Which documents? (ID, SS card, birth certificate…)"
              className="mt-2"
            />
          )}
        </div>
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
