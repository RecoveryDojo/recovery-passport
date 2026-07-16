import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Check, X, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  onCompleted: () => void;
}

export function IntakeReviewStep({ sessionId, onCompleted }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["intake-review", sessionId],
    queryFn: async () => {
      const [
        sessionRes,
        signaturesRes,
        assessmentRes,
        substancesRes,
        clinicalRes,
        screeningRes,
        belongingsRes,
      ] = await Promise.all([
        supabase
          .from("intake_sessions")
          .select("id, participant_id, goal_1, goal_2, goal_3, room_note")
          .eq("id", sessionId)
          .single(),
        supabase.from("intake_form_signatures").select("form_type").eq("intake_session_id", sessionId),
        supabase
          .from("assessment_sessions")
          .select("id, completed_at")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase.from("intake_substance_use").select("id, substance_name").eq("intake_session_id", sessionId),
        supabase
          .from("intake_clinical_details")
          .select("id")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("intake_screening_results")
          .select("id, breathalyzer_result")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("intake_belongings_log")
          .select("id, prohibited_items_found, dryer_treatment_completed")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
      ]);

      const s = sessionRes.data!;
      let participant: {
        first_name: string | null;
        last_name: string | null;
        user_id: string | null;
        email: string | null;
      } | null = null;

      let demographicsPresent = false;
      if (s.participant_id) {
        const [{ data: pp }, { data: demo }] = await Promise.all([
          supabase
            .from("participant_profiles")
            .select("first_name, last_name, user_id")
            .eq("id", s.participant_id)
            .single(),
          supabase
            .from("participant_demographics")
            .select("id")
            .eq("participant_id", s.participant_id)
            .maybeSingle(),
        ]);
        demographicsPresent = !!demo;
        let email: string | null = null;
        if (pp?.user_id) {
          const { data: u } = await supabase.from("users").select("email").eq("id", pp.user_id).single();
          email = u?.email ?? null;
        }
        participant = { ...pp!, email };
      }

      const signedTypes = new Set((signaturesRes.data ?? []).map((r) => r.form_type));

      return {
        session: s,
        participant,
        signedTypes,
        assessment: assessmentRes.data,
        substances: substancesRes.data ?? [],
        clinicalPresent: !!clinicalRes.data,
        demographicsPresent,
        screening: screeningRes.data,
        belongings: belongingsRes.data,
      };
    },
  });

  const handleSendReset = async () => {
    if (!data?.participant?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.participant.email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setSendingReset(false);
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("complete-intake-session", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      if ((result as any)?.error) throw new Error((result as any).error);
      toast.success("Intake complete");
      onCompleted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const FORMS = [
    { key: "house_rules", label: "House Rules" },
    { key: "disclosure_consent", label: "Consent to Disclose" },
    { key: "belongings_consent", label: "Personal Belongings Consent" },
    { key: "services_consent", label: "Consent for Services" },
    { key: "liability_waiver", label: "Liability Waiver" },
    { key: "non_tenancy", label: "Non-Tenancy Acknowledgement" },
    { key: "contribution_agreement", label: "Contribution Agreement" },
  ] as const;

  const row = (label: string, ok: boolean, extra?: string) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-foreground">{label}</span>
      <span className="flex items-center gap-2 text-muted-foreground">
        {extra && <span>{extra}</span>}
        {ok ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground/60" />
        )}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-primary">Review &amp; Complete</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm everything was captured, then complete the intake.
        </p>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Signed forms</h3>
        {FORMS.map((f) => row(f.label, data.signedTypes.has(f.key)))}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Session</h3>
        {row(
          "Three goals",
          !!(data.session.goal_1 && data.session.goal_2 && data.session.goal_3),
        )}
        {row("First assessment", !!data.assessment?.completed_at)}
        {row(
          "Substance history",
          data.substances.length > 0 || data.clinicalPresent,
          data.substances.length ? `${data.substances.length} substance(s)` : undefined,
        )}
        {row("Demographics recorded", data.demographicsPresent)}
        {row(
          "Screening",
          !!data.screening,
          data.screening?.breathalyzer_result != null
            ? `BAC ${data.screening.breathalyzer_result}`
            : undefined,
        )}
        {row(
          "Belongings search",
          !!data.belongings,
          data.belongings?.prohibited_items_found ? "prohibited found" : undefined,
        )}
        {row("Room note", !!data.session.room_note)}
      </Card>

      <Card className="p-4 space-y-3 bg-secondary/40">
        <div>
          <h3 className="text-sm font-semibold">Account handoff</h3>
          <p className="text-xs text-muted-foreground">
            Participant claims their account on their own device using the login email below.
          </p>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Login email: </span>
          <span className="font-mono break-all">
            {data.participant?.email ?? "—"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendReset}
          disabled={!data.participant?.email || sendingReset}
        >
          <Mail className="h-4 w-4 mr-2" />
          {sendingReset ? "Sending…" : "Send password reset"}
        </Button>
      </Card>

      <Button
        onClick={handleComplete}
        disabled={submitting}
        className="w-full min-h-[52px]"
      >
        {submitting ? "Completing…" : "Complete Intake"}
      </Button>
    </div>
  );
}
