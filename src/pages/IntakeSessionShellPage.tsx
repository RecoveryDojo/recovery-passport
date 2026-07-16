import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IntakeFormStep } from "@/components/intake/IntakeFormStep";
import { IntakeGoalsStep } from "@/components/intake/IntakeGoalsStep";
import { IntakeFirstAssessmentStep } from "@/components/intake/IntakeFirstAssessmentStep";
import type { Database } from "@/integrations/supabase/types";

type IntakeFormType = Database["public"]["Enums"]["intake_form_type"];

const FORM_STEP_MAP: Record<number, { formType: IntakeFormType; title: string }> = {
  2: { formType: "house_rules", title: "House Rules" },
  3: { formType: "disclosure_consent", title: "Consent to Disclose" },
  4: { formType: "belongings_consent", title: "Personal Belongings Consent" },
  5: { formType: "services_consent", title: "Consent for Services" },
  6: { formType: "liability_waiver", title: "Liability Waiver" },
  7: { formType: "non_tenancy", title: "Non-Tenancy Acknowledgement" },
  8: { formType: "contribution_agreement", title: "Contribution Agreement" },
};

const TOTAL_STEPS = 16;

const STEP_TITLES: Record<number, string> = {
  1: "Create Account",
  2: "House Rules",
  3: "Consent to Disclose",
  4: "Personal Belongings Consent",
  5: "Consent for Services",
  6: "Liability Waiver",
  7: "Non-Tenancy Acknowledgement",
  8: "Contribution Agreement",
  9: "Three Goals",
  10: "First Assessment",
  11: "Substance History & Medical",
  12: "Demographics",
  13: "Screening (Breathalyzer / UA)",
  14: "Belongings Search",
  15: "Room",
  16: "Review & Complete",
};

export default function IntakeSessionShellPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["intake-session", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_sessions")
        .select("*, participant:participant_profiles(id, first_name, last_name)")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [step, setStep] = useState(1);
  useEffect(() => {
    if (session?.current_step) setStep(session.current_step);
  }, [session?.current_step]);

  const saveStep = useMutation({
    mutationFn: async (nextStep: number) => {
      const completing = nextStep > TOTAL_STEPS;
      const { error } = await supabase
        .from("intake_sessions")
        .update({
          current_step: completing ? TOTAL_STEPS : nextStep,
          ...(completing
            ? { status: "completed" as const, completed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", sessionId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["in-progress-intakes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const goBack = async () => {
    if (step <= 1) return;
    setSaving(true);
    await saveStep.mutateAsync(step - 1);
    setStep((s) => s - 1);
    setSaving(false);
  };

  const goForward = async () => {
    setSaving(true);
    const next = step + 1;
    await saveStep.mutateAsync(next);
    if (next > TOTAL_STEPS) {
      toast.success("Intake complete");
      navigate("/caseload");
    } else {
      setStep(next);
    }
    setSaving(false);
  };

  if (isLoading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session.status === "completed") {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Intake complete</h1>
        <p className="text-muted-foreground">This session has already been completed.</p>
        <Button onClick={() => navigate("/caseload")}>Back to caseload</Button>
      </div>
    );
  }

  const participantName =
    session.participant?.first_name || session.participant?.last_name
      ? `${session.participant?.first_name ?? ""} ${session.participant?.last_name ?? ""}`.trim()
      : "New intake (unnamed)";

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Intake session</p>
        <h1 className="text-2xl font-bold text-foreground">{participantName}</h1>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-primary">Step {step} of {TOTAL_STEPS}</span>
          <span className="text-muted-foreground">{STEP_TITLES[step]}</span>
        </div>
        <Progress value={(step / TOTAL_STEPS) * 100} className="h-2" />
      </div>

      {FORM_STEP_MAP[step] ? (
        <IntakeFormStep
          key={step}
          sessionId={sessionId!}
          programId={session.program_id}
          formType={FORM_STEP_MAP[step].formType}
          title={FORM_STEP_MAP[step].title}
          onCompleted={goForward}
        />
      ) : (
        <Card className="p-6 min-h-[280px] flex items-center justify-center text-center">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Step {step}
            </p>
            <h2 className="text-xl font-semibold text-primary">{STEP_TITLES[step]}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              This screen will be implemented in a later phase. Your progress is saved automatically —
              you can safely close the tablet and resume from the caseload.
            </p>
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 min-h-[52px]"
          onClick={goBack}
          disabled={step <= 1 || saving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {!FORM_STEP_MAP[step] && (
          <Button
            className="flex-1 min-h-[52px]"
            onClick={goForward}
            disabled={saving}
          >
            {step === TOTAL_STEPS ? "Complete Intake" : "Continue"}
            {step !== TOTAL_STEPS && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
