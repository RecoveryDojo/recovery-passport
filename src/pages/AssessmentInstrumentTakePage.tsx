/**
 * Generic take page for non-RC instruments (PHQ-9, GAD-7, custom).
 *
 * HARD RULE: This page never calls generate_recovery_plan. That RPC reads
 * assessment_scores + assessment_domains, which non-RC instruments do not
 * populate. Recovery Capital keeps its own take page at /assessment/take.
 *
 * Flag evaluation is item-type-aware:
 *  - numeric items compare on numeric_value
 *  - option-based items (labeled_scale, single_select, yes_no, multi_select)
 *    compare on the selected option's value (i.e. the response's points),
 *    NOT on numeric_value (which is null by design for those items).
 */
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";

type Instrument = {
  id: string;
  title: string;
  description: string | null;
  scoring_method: "sum" | "average";
  produces_overall_score: boolean;
  higher_is_better: boolean;
  min_score: number | null;
  max_score: number | null;
  status: "draft" | "published" | "archived";
};
type Item = {
  id: string;
  prompt: string;
  item_type: "labeled_scale" | "single_select" | "multi_select" | "yes_no" | "numeric" | "free_text";
  sort_order: number;
  is_required: boolean;
  is_reverse_scored: boolean;
  is_flag_item: boolean;
  flag_threshold: number | null;
  help_text: string | null;
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

type ResponseValue =
  | { kind: "option"; optionIds: string[]; points: number }
  | { kind: "numeric"; value: number; points: number }
  | { kind: "text"; text: string };

const AssessmentInstrumentTakePage = () => {
  const { instrumentId } = useParams<{ instrumentId: string }>();
  const [search] = useSearchParams();
  const assignmentId = search.get("assignment") || null;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ResponseValue>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [crisis, setCrisis] = useState<{ label: string; guidance: string | null } | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["participant-profile-take", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id, assigned_peer_id, first_name, last_name")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: instrument } = useQuery({
    queryKey: ["take-instrument", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments")
        .select("id, title, description, scoring_method, produces_overall_score, higher_is_better, min_score, max_score, status")
        .eq("id", instrumentId!)
        .single();
      if (error) throw error;
      return data as Instrument;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["take-items", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data: itemRows, error } = await supabase
        .from("assessment_instrument_items")
        .select("id, prompt, item_type, sort_order, is_required, is_reverse_scored, is_flag_item, flag_threshold, help_text")
        .eq("instrument_id", instrumentId!)
        .order("sort_order");
      if (error) throw error;
      const ids = itemRows.map((r) => r.id);
      const { data: optRows } = ids.length
        ? await supabase
            .from("assessment_instrument_options")
            .select("id, item_id, label, value, sort_order")
            .in("item_id", ids)
            .order("sort_order")
        : { data: [] as any[] };
      return itemRows.map((r) => ({
        ...r,
        options: (optRows ?? []).filter((o: any) => o.item_id === r.id),
      })) as Item[];
    },
  });

  const { data: bands } = useQuery({
    queryKey: ["take-bands", instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_bands")
        .select("id, min_score, max_score, label, severity, guidance, triggers_alert")
        .eq("instrument_id", instrumentId!)
        .order("min_score");
      if (error) throw error;
      return data as Band[];
    },
  });

  const overallScore = useMemo(() => {
    if (!items) return 0;
    const pointsList = items
      .map((it) => answers[it.id])
      .filter((a): a is ResponseValue => !!a)
      .map((a) => (a.kind === "text" ? 0 : a.points));
    if (pointsList.length === 0) return 0;
    if (instrument?.scoring_method === "average") {
      return Number((pointsList.reduce((a, b) => a + b, 0) / pointsList.length).toFixed(2));
    }
    return pointsList.reduce((a, b) => a + b, 0);
  }, [items, answers, instrument]);

  if (!instrument || !items || !profile) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const total = items.length;
  const current = items[idx];
  const currentAnswer = current ? answers[current.id] : undefined;
  const isAnswered = (a?: ResponseValue) =>
    !!a && (a.kind === "text" ? a.text.trim().length > 0 : true);

  const setOption = (item: Item, opt: { id: string; value: number }) => {
    const raw = opt.value;
    const maxOpt = Math.max(...(item.options ?? []).map((o) => o.value));
    const points = item.is_reverse_scored ? maxOpt - raw : raw;
    setAnswers((prev) => ({ ...prev, [item.id]: { kind: "option", optionIds: [opt.id], points } }));
  };
  const toggleMulti = (item: Item, opt: { id: string; value: number }) => {
    setAnswers((prev) => {
      const existing = prev[item.id];
      const current = existing?.kind === "option" ? existing.optionIds : [];
      const next = current.includes(opt.id) ? current.filter((id) => id !== opt.id) : [...current, opt.id];
      const selectedValues = (item.options ?? [])
        .filter((o) => next.includes(o.id))
        .map((o) => (item.is_reverse_scored ? Math.max(...(item.options ?? []).map((x) => x.value)) - o.value : o.value));
      // for multi_select, "points" contributed to overall is sum; for flag eval we use max
      const points = selectedValues.reduce((a, b) => a + b, 0);
      return { ...prev, [item.id]: { kind: "option", optionIds: next, points } };
    });
  };
  const setNumeric = (item: Item, v: number) => {
    const points = item.is_reverse_scored && item.flag_threshold != null ? -v : v;
    setAnswers((prev) => ({ ...prev, [item.id]: { kind: "numeric", value: v, points } }));
  };
  const setText = (item: Item, t: string) => {
    setAnswers((prev) => ({ ...prev, [item.id]: { kind: "text", text: t } }));
  };

  const handleNext = () => {
    if (idx < total - 1) setIdx((i) => i + 1);
    else setShowResults(true);
  };
  const handleBack = () => {
    if (showResults) setShowResults(false);
    else if (idx > 0) setIdx((i) => i - 1);
  };

  const evaluateFlag = (item: Item, ans: ResponseValue): boolean => {
    if (!item.is_flag_item || item.flag_threshold == null) return false;
    if (item.item_type === "numeric") {
      return ans.kind === "numeric" && ans.value >= item.flag_threshold;
    }
    if (item.item_type === "multi_select" && ans.kind === "option") {
      // for multi, use max selected option value against threshold
      const maxVal = (item.options ?? [])
        .filter((o) => ans.optionIds.includes(o.id))
        .reduce((m, o) => Math.max(m, o.value), -Infinity);
      return maxVal >= item.flag_threshold;
    }
    // option-based single: compare stored points (already reverse-adjusted if applicable)
    // For clinical items like PHQ-9 item 9, is_reverse_scored=false so points === option value.
    if (ans.kind === "option") return ans.points >= item.flag_threshold;
    return false;
  };

  const activeBand = (): Band | null => {
    if (!bands) return null;
    return bands.find((b) => overallScore >= b.min_score && overallScore <= b.max_score) ?? null;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Determine flagged responses
      const flaggedItemIds = new Set<string>();
      for (const it of items) {
        const a = answers[it.id];
        if (a && evaluateFlag(it, a)) flaggedItemIds.add(it.id);
      }
      const band = activeBand();
      const bandAlert = !!band?.triggers_alert;
      const anyFlagged = flaggedItemIds.size > 0 || bandAlert;

      // Insert session
      const { data: session, error: sErr } = await supabase
        .from("assessment_sessions")
        .insert({
          participant_id: profile.id,
          initiated_by: user!.id,
          instrument_id: instrument.id,
          assignment_id: assignmentId,
          overall_score: instrument.produces_overall_score ? overallScore : null,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;

      // Insert responses
      const responseRows = items.map((it) => {
        const a = answers[it.id];
        if (!a) return null;
        const flagged = evaluateFlag(it, a);
        const base = { session_id: session.id, item_id: it.id, flagged };
        if (a.kind === "option") {
          // Store first optionId in option_id (schema single fk) — full set encoded via points.
          return { ...base, option_id: a.optionIds[0] ?? null, points: a.points, numeric_value: null, text_value: null };
        }
        if (a.kind === "numeric") {
          return { ...base, option_id: null, points: a.points, numeric_value: a.value, text_value: null };
        }
        return { ...base, option_id: null, points: null, numeric_value: null, text_value: a.text };
      }).filter(Boolean) as any[];

      if (responseRows.length > 0) {
        const { error: rErr } = await supabase.from("assessment_responses").insert(responseRows);
        if (rErr) throw rErr;
      }

      // Mark assignment complete if applicable
      if (assignmentId) {
        await supabase
          .from("assessment_assignments")
          .update({ status: "completed" as const })
          .eq("id", assignmentId);
      }

      // Audit
      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: anyFlagged ? "submit_assessment_flagged" : "submit_assessment",
        target_type: "assessment_sessions",
        target_id: session.id,
        metadata: {
          instrument_id: instrument.id,
          instrument_title: instrument.title,
          overall_score: overallScore,
          flagged_items: [...flaggedItemIds],
          band_alert: bandAlert,
        },
      });

      // Notify peer / admins
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "A participant";
      const notifications: any[] = [];

      if (profile.assigned_peer_id) {
        notifications.push({
          user_id: profile.assigned_peer_id,
          type: anyFlagged ? ("assessment_flagged" as const) : ("assessment_ready_for_review" as const),
          title: anyFlagged ? `⚠️ ${instrument.title} flag — needs review` : `${instrument.title} ready for review`,
          body: anyFlagged
            ? `${name} completed ${instrument.title} with a safety flag or alert-level score. Please review.`
            : `${name} completed ${instrument.title}.`,
          link: `/caseload/${profile.id}`,
        });
      }
      if (anyFlagged) {
        // Also notify admins (interim supervisor audience)
        const { data: admins } = await supabase.from("users").select("id").eq("role", "admin");
        (admins ?? []).forEach((a) => {
          notifications.push({
            user_id: a.id,
            type: "assessment_flagged" as const,
            title: `⚠️ ${instrument.title} flag`,
            body: `${name} completed ${instrument.title} with a safety flag or alert-level score.`,
            link: `/admin/participants`,
          });
        });
      }
      if (notifications.length) {
        await supabase.from("notifications").insert(notifications);
      }

      if (anyFlagged) {
        // Surface crisis protocol inline
        const { data: proto } = await supabase
          .from("crisis_protocol")
          .select("label, description")
          .order("sort_order")
          .limit(1)
          .maybeSingle();
        setCrisis({
          label: proto?.label ?? "If you are in immediate crisis, call 988 or 911.",
          guidance: proto?.description ?? null,
        });
        toast.warning("Assessment submitted — flagged for peer review.");
      } else {
        toast.success("Assessment submitted!");
        navigate("/card");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assessment");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- CRISIS SCREEN ----------
  if (crisis) {
    return (
      <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-bold">You're not alone.</p>
          </div>
          <p className="text-sm text-foreground font-medium">{crisis.label}</p>
          {crisis.guidance && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{crisis.guidance}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Your peer specialist has been notified and will follow up.
          </p>
        </div>
        <Button className="w-full" onClick={() => navigate("/card")}>
          Back to my card
        </Button>
      </div>
    );
  }

  // ---------- RESULTS ----------
  if (showResults) {
    const band = activeBand();
    return (
      <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-foreground">{instrument.title} — Review</h1>
        {instrument.produces_overall_score && (
          <div className="text-center py-4">
            <p className="text-5xl font-extrabold text-accent">{overallScore}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Range {instrument.min_score ?? 0}–{instrument.max_score ?? "?"}
            </p>
            {band && (
              <div className="mt-3 inline-block px-3 py-1 rounded-full bg-muted text-sm font-medium text-foreground">
                {band.label}
              </div>
            )}
            {band?.guidance && (
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">{band.guidance}</p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Your peer specialist will review this assessment.
        </p>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    );
  }

  // ---------- ITEM STEP ----------
  if (!current) {
    return <div className="p-6 text-sm text-muted-foreground">No items in this assessment.</div>;
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
      <Link to="/card" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {idx === 0 ? "Cancel" : "Back"}
      </Link>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{instrument.title}</span>
          <span>{idx + 1} of {total}</span>
        </div>
        <Progress value={((idx + 1) / total) * 100} className="h-2" />
      </div>

      <div>
        <h1 className="text-lg font-bold text-foreground">{current.prompt}</h1>
        {current.help_text && (
          <p className="text-sm text-muted-foreground mt-1">{current.help_text}</p>
        )}
      </div>

      {/* Option-based */}
      {(current.item_type === "labeled_scale" || current.item_type === "single_select") && (
        <div className="space-y-2">
          {(current.options ?? []).map((opt) => {
            const selected = currentAnswer?.kind === "option" && currentAnswer.optionIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => setOption(current, opt)}
                className={`w-full text-left rounded-xl border-2 p-3 transition-all flex items-center justify-between ${
                  selected ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent/50"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                {selected && <Check className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
      {current.item_type === "yes_no" && (
        <div className="grid grid-cols-2 gap-3">
          {(current.options ?? [{ id: "yes", label: "Yes", value: 1, sort_order: 0 }, { id: "no", label: "No", value: 0, sort_order: 1 }]).map((opt) => {
            const selected = currentAnswer?.kind === "option" && currentAnswer.optionIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => setOption(current, opt)}
                className={`rounded-xl border-2 p-4 font-medium text-foreground ${
                  selected ? "border-accent bg-accent/10" : "border-border bg-card"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      {current.item_type === "multi_select" && (
        <div className="space-y-2">
          {(current.options ?? []).map((opt) => {
            const selected = currentAnswer?.kind === "option" && currentAnswer.optionIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleMulti(current, opt)}
                className={`w-full text-left rounded-xl border-2 p-3 flex items-center justify-between ${
                  selected ? "border-accent bg-accent/10" : "border-border bg-card"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                {selected && <Check className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
      {current.item_type === "numeric" && (
        <Input
          type="number"
          value={currentAnswer?.kind === "numeric" ? currentAnswer.value : ""}
          onChange={(e) => setNumeric(current, Number(e.target.value))}
        />
      )}
      {current.item_type === "free_text" && (
        <Textarea
          value={currentAnswer?.kind === "text" ? currentAnswer.text : ""}
          onChange={(e) => setText(current, e.target.value)}
          rows={4}
        />
      )}

      <Button
        onClick={handleNext}
        disabled={current.is_required && !isAnswered(currentAnswer)}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        {idx < total - 1 ? (<>Next <ArrowRight className="h-4 w-4 ml-1" /></>) : "Review"}
      </Button>
    </div>
  );
};

export default AssessmentInstrumentTakePage;
