import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import PacketSection, { Field } from "./PacketSection";

const FORM_LABELS: Record<string, string> = {
  house_rules: "House Rules",
  disclosure_consent: "Consent to Disclose",
  belongings_consent: "Personal Belongings Consent",
  services_consent: "Consent for Services",
  liability_waiver: "Liability Waiver",
  non_tenancy: "Non-Tenancy Acknowledgement",
  contribution_agreement: "Contribution Agreement",
};
const FORM_ORDER = Object.keys(FORM_LABELS);

const PNTS = "__pnts__";

function demoValue(v: string | null | undefined) {
  if (!v) return undefined;
  if (v === PNTS) return "Prefer not to say";
  return v;
}

function fmt(d?: string | null, withTime = false) {
  if (!d) return undefined;
  try {
    return format(parseISO(d), withTime ? "MMM d, yyyy h:mm a" : "MMM d, yyyy");
  } catch {
    return d;
  }
}

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default function IntakePacket({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["intake-packet", sessionId],
    queryFn: async () => {
      const { data: session, error: sErr } = await supabase
        .from("intake_sessions")
        .select(
          "id, participant_id, program_id, started_by, status, current_step, goal_1, goal_2, goal_3, room_note, started_at, completed_at",
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session) return null;

      const [
        profileRes,
        programRes,
        peerRes,
        sigsRes,
        contactsRes,
        clinicalRes,
        substancesRes,
        screeningRes,
        belongingsRes,
        assessmentRes,
        auditRes,
      ] = await Promise.all([
        session.participant_id
          ? supabase
              .from("participant_profiles")
              .select(
                "id, user_id, first_name, last_name, date_of_birth, admission_date, participant_status, substances, pathway",
              )
              .eq("id", session.participant_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        session.program_id
          ? supabase.from("programs").select("name, type").eq("id", session.program_id).maybeSingle()
          : Promise.resolve({ data: null }),
        session.started_by
          ? supabase
              .from("peer_specialist_profiles")
              .select("first_name, last_name")
              .eq("user_id", session.started_by)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("intake_form_signatures")
          .select(
            "id, form_type, template_id, initials, signature_image_path, witness_signature_image_path, signed_at",
          )
          .eq("intake_session_id", sessionId),
        supabase
          .from("intake_authorized_contacts")
          .select("name, relationship, phone")
          .eq("intake_session_id", sessionId),
        supabase
          .from("intake_clinical_details")
          .select("*")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase.from("intake_substance_use").select("*").eq("intake_session_id", sessionId),
        supabase
          .from("intake_screening_results")
          .select("*")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("intake_belongings_log")
          .select("*")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("assessment_sessions")
          .select("id, overall_score, completed_at, instrument_id")
          .eq("intake_session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("audit_log")
          .select("id, action, user_id, created_at, metadata")
          .eq("target_type", "intake_sessions")
          .eq("target_id", sessionId)
          .order("created_at", { ascending: true }),
      ]);

      // Signed form templates + signature images
      const templateIds = Array.from(
        new Set((sigsRes.data ?? []).map((s) => s.template_id).filter(Boolean) as string[]),
      );
      const templatesById = new Map<string, { title: string; content: string; version: number }>();
      if (templateIds.length) {
        const { data: tpls } = await supabase
          .from("intake_form_templates")
          .select("id, title, content, version")
          .in("id", templateIds);
        (tpls ?? []).forEach((t) =>
          templatesById.set(t.id, { title: t.title, content: t.content, version: t.version }),
        );
      }
      const signatures = await Promise.all(
        (sigsRes.data ?? []).map(async (s) => ({
          ...s,
          template: s.template_id ? templatesById.get(s.template_id) : undefined,
          participantUrl: await signedUrl(s.signature_image_path),
          witnessUrl: await signedUrl(s.witness_signature_image_path),
        })),
      );
      signatures.sort(
        (a, b) => FORM_ORDER.indexOf(a.form_type) - FORM_ORDER.indexOf(b.form_type),
      );

      // Demographics (keyed on participant profile)
      let demographics: Record<string, string | null> | null = null;
      if (session.participant_id) {
        const { data: demo } = await supabase
          .from("participant_demographics")
          .select("race_ethnicity, gender, primary_language, sexual_orientation_gender_identity")
          .eq("participant_id", session.participant_id)
          .maybeSingle();
        demographics = demo ?? null;
      }

      // UA panels hang off the screening result
      let uaPanels: { panel_name: string; result: string }[] = [];
      if (screeningRes.data?.id) {
        const { data: panels } = await supabase
          .from("intake_ua_panels")
          .select("panel_name, result")
          .eq("screening_result_id", screeningRes.data.id);
        uaPanels = (panels ?? []) as { panel_name: string; result: string }[];
      }

      // Assessment domain scores
      let scores: { score: number; domain: string }[] = [];
      let instrumentName: string | null = null;
      if (assessmentRes.data?.id) {
        const { data: rawScores } = await supabase
          .from("assessment_scores")
          .select("score, domain_id")
          .eq("session_id", assessmentRes.data.id);
        const domainIds = Array.from(new Set((rawScores ?? []).map((s) => s.domain_id)));
        const domainNames = new Map<string, string>();
        if (domainIds.length) {
          const { data: domains } = await supabase
            .from("assessment_domains")
            .select("id, name")
            .in("id", domainIds);
          (domains ?? []).forEach((d) => domainNames.set(d.id, d.name));
        }
        scores = (rawScores ?? []).map((s) => ({
          score: s.score,
          domain: domainNames.get(s.domain_id) ?? s.domain_id,
        }));
        if (assessmentRes.data.instrument_id) {
          const { data: inst } = await supabase
            .from("assessment_instruments")
            .select("name")
            .eq("id", assessmentRes.data.instrument_id)
            .maybeSingle();
          instrumentName = inst?.name ?? null;
        }
      }

      // Actor names for the audit trail
      const actorIds = Array.from(
        new Set((auditRes.data ?? []).map((a) => a.user_id).filter(Boolean) as string[]),
      );
      const actors = new Map<string, string>();
      if (actorIds.length) {
        const { data: us } = await supabase.from("users").select("id, email").in("id", actorIds);
        (us ?? []).forEach((u) => actors.set(u.id, u.email));
      }

      return {
        session,
        profile: profileRes.data,
        program: programRes.data,
        peer: peerRes.data,
        signatures,
        contacts: contactsRes.data ?? [],
        clinical: clinicalRes.data,
        substances: substancesRes.data ?? [],
        screening: screeningRes.data,
        uaPanels,
        belongings: belongingsRes.data,
        assessment: assessmentRes.data,
        instrumentName,
        scores,
        demographics,
        audit: (auditRes.data ?? []).map((a) => ({ ...a, actor: actors.get(a.user_id ?? "") })),
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center space-y-2">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          This intake packet is unavailable or you don't have access to it.
        </p>
      </div>
    );
  }

  const {
    session,
    profile,
    program,
    peer,
    signatures,
    contacts,
    clinical,
    substances,
    screening,
    uaPanels,
    belongings,
    assessment,
    instrumentName,
    scores,
    demographics,
    audit,
  } = data;

  const participantName = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unnamed participant"
    : "Unknown participant";

  return (
    <div className="space-y-4 pb-24 print:space-y-6">
      {/* Header */}
      <Card className="p-4 space-y-3 print:shadow-none print:border-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-primary">{participantName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Intake packet</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={session.status === "completed" ? "default" : "secondary"}
              className="capitalize"
            >
              {String(session.status).replace(/_/g, " ")}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="print:hidden"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date of birth" value={fmt(profile?.date_of_birth)} />
          <Field label="Program" value={program?.name} />
          <Field label="Admission date" value={fmt(profile?.admission_date)} />
          <Field
            label="Intake run by"
            value={peer ? `${peer.first_name} ${peer.last_name}`.trim() : undefined}
          />
          <Field label="Started" value={fmt(session.started_at, true)} />
          <Field label="Completed" value={fmt(session.completed_at, true)} />
        </div>
        {session.status !== "completed" && (
          <p className="text-xs text-muted-foreground">
            In progress — currently on step {session.current_step ?? 1} of 16.
          </p>
        )}
      </Card>

      {/* 1. Signed forms */}
      <PacketSection
        title="Signed forms"
        subtitle={`${signatures.length} of 7 forms signed`}
        defaultOpen
      >
        {signatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No forms signed yet.</p>
        ) : (
          <div className="space-y-4">
            {signatures.map((s) => (
              <div key={s.id} className="border rounded-md p-3 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-medium">
                    {s.template?.title ?? FORM_LABELS[s.form_type] ?? s.form_type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.template?.version ? `v${s.template.version} · ` : ""}
                    {fmt(s.signed_at, true)}
                  </div>
                </div>
                {s.template?.content && (
                  <div className="text-xs whitespace-pre-wrap bg-secondary/40 rounded p-3 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible">
                    {s.template.content}
                  </div>
                )}
                {s.initials && Object.keys(s.initials as object).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Initialed clauses: {Object.keys(s.initials as object).length}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Participant signature</div>
                    {s.participantUrl ? (
                      <img
                        src={s.participantUrl}
                        alt={`Participant signature for ${FORM_LABELS[s.form_type] ?? s.form_type}`}
                        className="border rounded bg-white w-full h-24 object-contain"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">Not provided</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Staff witness signature</div>
                    {s.witnessUrl ? (
                      <img
                        src={s.witnessUrl}
                        alt={`Witness signature for ${FORM_LABELS[s.form_type] ?? s.form_type}`}
                        className="border rounded bg-white w-full h-24 object-contain"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">Not provided</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PacketSection>

      {/* 2. Authorized contacts */}
      <PacketSection title="Authorized contacts" subtitle={`${contacts.length} listed`}>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">None listed.</p>
        ) : (
          <div className="divide-y">
            {contacts.map((c, i) => (
              <div key={i} className="py-2 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.relationship, c.phone].filter(Boolean).join(" · ") || "No details"}
                </div>
              </div>
            ))}
          </div>
        )}
      </PacketSection>

      {/* 3. Goals */}
      <PacketSection title="Three goals">
        {[session.goal_1, session.goal_2, session.goal_3].filter(Boolean).length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals recorded.</p>
        ) : (
          <ol className="list-decimal list-inside text-sm space-y-1">
            {[session.goal_1, session.goal_2, session.goal_3]
              .filter(Boolean)
              .map((g, i) => (
                <li key={i}>{g}</li>
              ))}
          </ol>
        )}
      </PacketSection>

      {/* 4. First assessment */}
      <PacketSection
        title="First assessment"
        subtitle={instrumentName ?? "Recovery Capital"}
      >
        {!assessment ? (
          <p className="text-sm text-muted-foreground">
            No assessment was completed during this intake.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Overall score" value={assessment.overall_score ?? undefined} />
              <Field label="Completed" value={fmt(assessment.completed_at, true)} />
            </div>
            {scores.length > 0 && (
              <div className="divide-y">
                {scores.map((s, i) => (
                  <div key={i} className="py-1.5 flex items-center justify-between text-sm">
                    <span>{s.domain}</span>
                    <span className="font-medium">{s.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PacketSection>

      {/* 5. Clinical picture */}
      <PacketSection title="Clinical picture">
        {!clinical && substances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Medical concerns" value={clinical?.medical_concerns} />
              <Field
                label="Hospitalized in last 90 days"
                value={
                  clinical?.hospitalized_last_90_days === null ||
                  clinical?.hospitalized_last_90_days === undefined
                    ? undefined
                    : clinical.hospitalized_last_90_days
                      ? "Yes"
                      : "No"
                }
              />
              <Field label="Prior recovery pathways" value={clinical?.prior_pathways} />
              <Field
                label="Needs vital documents"
                value={
                  clinical?.needs_vital_docs === null || clinical?.needs_vital_docs === undefined
                    ? undefined
                    : clinical.needs_vital_docs
                      ? "Yes"
                      : "No"
                }
              />
              <Field label="Vital document notes" value={clinical?.vital_docs_notes} />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Reported substance use
              </div>
              {substances.length === 0 ? (
                <p className="text-sm text-muted-foreground">None reported.</p>
              ) : (
                <div className="divide-y">
                  {substances.map((s) => (
                    <div key={s.id} className="py-2 text-sm">
                      <div className="font-medium capitalize">{s.substance_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          s.frequency_of_use
                            ? `Frequency: ${String(s.frequency_of_use).replace(/_/g, " ")}`
                            : null,
                          s.route_of_use ? `Route: ${s.route_of_use}` : null,
                          s.age_of_first_use ? `First use at ${s.age_of_first_use}` : null,
                          s.last_use_date ? `Last use ${fmt(s.last_use_date)}` : null,
                          s.prior_treatment_attempts !== null &&
                          s.prior_treatment_attempts !== undefined
                            ? `${s.prior_treatment_attempts} prior treatment attempts`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No details"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PacketSection>

      {/* 6. Demographics */}
      <PacketSection title="Demographics">
        {!demographics ? (
          <p className="text-sm text-muted-foreground">Not collected.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Race / ethnicity" value={demoValue(demographics.race_ethnicity)} />
            <Field label="Gender" value={demoValue(demographics.gender)} />
            <Field label="Primary language" value={demoValue(demographics.primary_language)} />
            <Field
              label="Sexual orientation / gender identity"
              value={demoValue(demographics.sexual_orientation_gender_identity)}
            />
          </div>
        )}
      </PacketSection>

      {/* 7. Screening */}
      <PacketSection title="Screening">
        {!screening ? (
          <p className="text-sm text-muted-foreground">No screening recorded.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Breathalyzer result"
                value={
                  screening.breathalyzer_result === null ||
                  screening.breathalyzer_result === undefined
                    ? undefined
                    : String(screening.breathalyzer_result)
                }
              />
              <Field label="Administered" value={fmt(screening.administered_at, true)} />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                UA panel
              </div>
              {uaPanels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No panel results recorded.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {uaPanels.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                      <span>{p.panel_name}</span>
                      <Badge
                        variant={p.result === "positive" ? "destructive" : "secondary"}
                        className="capitalize"
                      >
                        {String(p.result).replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PacketSection>

      {/* 8. Belongings */}
      <PacketSection title="Belongings search">
        {!belongings ? (
          <p className="text-sm text-muted-foreground">No belongings log recorded.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Items summary" value={belongings.items_summary} />
            <Field
              label="Prohibited items found"
              value={belongings.prohibited_items_found ? "Yes" : "No"}
            />
            <Field label="Prohibited item notes" value={belongings.prohibited_items_notes} />
            <Field
              label="Dryer treatment completed"
              value={belongings.dryer_treatment_completed ? "Yes" : "No"}
            />
          </div>
        )}
      </PacketSection>

      {/* 9. Room */}
      <PacketSection title="Room assignment">
        {session.room_note ? (
          <p className="text-sm whitespace-pre-wrap">{session.room_note}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No room note recorded.</p>
        )}
      </PacketSection>

      {/* 10. Audit trail */}
      <PacketSection title="Audit trail" subtitle={`${audit.length} events`}>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events recorded.</p>
        ) : (
          <div className="divide-y">
            {audit.map((a) => (
              <div key={a.id} className="py-2 text-sm flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium capitalize">
                    {a.action.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-muted-foreground">{a.actor ?? "System"}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {fmt(a.created_at, true)}
                </div>
              </div>
            ))}
          </div>
        )}
      </PacketSection>
    </div>
  );
}
