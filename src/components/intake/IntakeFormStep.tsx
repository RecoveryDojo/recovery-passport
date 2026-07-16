import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "./SignatureCanvas";
import type { Database } from "@/integrations/supabase/types";

type IntakeFormType = Database["public"]["Enums"]["intake_form_type"];

interface Contact {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
}

interface IntakeFormStepProps {
  sessionId: string;
  programId: string;
  formType: IntakeFormType;
  title: string;
  onCompleted: () => void;
}

export function IntakeFormStep({
  sessionId,
  programId,
  formType,
  title,
  onCompleted,
}: IntakeFormStepProps) {
  const { user } = useAuth();
  const [participantPath, setParticipantPath] = useState<string | null>(null);
  const [witnessPath, setWitnessPath] = useState<string | null>(null);
  const [initials, setInitials] = useState<{ peer_support: boolean; assessments: boolean }>({
    peer_support: false,
    assessments: false,
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Template
  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ["intake-form-template", programId, formType],
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_form_templates")
        .select("*")
        .eq("program_id", programId)
        .eq("form_type", formType)
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Existing signature (in case peer is resuming)
  const { data: existing } = useQuery({
    queryKey: ["intake-form-signature", sessionId, formType],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_form_signatures")
        .select("*")
        .eq("intake_session_id", sessionId)
        .eq("form_type", formType)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Existing authorized contacts for disclosure_consent
  const { data: existingContacts } = useQuery({
    queryKey: ["intake-authorized-contacts", sessionId],
    enabled: !!sessionId && formType === "disclosure_consent",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_authorized_contacts")
        .select("*")
        .eq("intake_session_id", sessionId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existingContacts && existingContacts.length > 0) {
      setContacts(
        existingContacts.map((c) => ({
          id: c.id,
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
        }))
      );
    }
  }, [existingContacts]);

  useEffect(() => {
    if (existing) {
      setParticipantPath(existing.signature_image_path);
      setWitnessPath(existing.witness_signature_image_path);
      if (existing.initials && typeof existing.initials === "object") {
        const i = existing.initials as { peer_support?: boolean; assessments?: boolean };
        setInitials({
          peer_support: !!i.peer_support,
          assessments: !!i.assessments,
        });
      }
    }
  }, [existing]);

  const isServicesConsent = formType === "services_consent";
  const isDisclosure = formType === "disclosure_consent";
  const isHouseRules = formType === "house_rules";

  const initialsComplete = !isServicesConsent || (initials.peer_support && initials.assessments);
  const contactsValid =
    !isDisclosure ||
    contacts.every((c) => c.name.trim() && c.relationship.trim() && c.phone.trim());

  const canContinue = useMemo(
    () =>
      !!template &&
      !!participantPath &&
      !!witnessPath &&
      initialsComplete &&
      contactsValid &&
      !existing,
    [template, participantPath, witnessPath, initialsComplete, contactsValid, existing]
  );

  const addContact = () => {
    if (contacts.length >= 3) return;
    setContacts((c) => [...c, { name: "", relationship: "", phone: "" }]);
  };

  const updateContact = (idx: number, patch: Partial<Contact>) => {
    setContacts((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeContact = (idx: number) => {
    setContacts((cs) => cs.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!template || !user || !participantPath || !witnessPath) return;
    setSubmitting(true);
    try {
      // Save authorized contacts (replace existing set)
      if (isDisclosure) {
        await supabase.from("intake_authorized_contacts").delete().eq("intake_session_id", sessionId);
        if (contacts.length > 0) {
          const { error: contactsErr } = await supabase.from("intake_authorized_contacts").insert(
            contacts.map((c) => ({
              intake_session_id: sessionId,
              name: c.name.trim(),
              relationship: c.relationship.trim(),
              phone: c.phone.trim(),
            }))
          );
          if (contactsErr) throw contactsErr;
        }
      }

      const { error } = await supabase.from("intake_form_signatures").insert({
        intake_session_id: sessionId,
        form_type: formType,
        template_id: template.id,
        initials: isServicesConsent ? initials : null,
        signature_image_path: participantPath,
        witness_signature_image_path: witnessPath,
        witness_staff_id: user.id,
      });
      if (error) throw error;

      toast.success("Form signed");
      onCompleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save form");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTemplate) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No current template found for <strong>{title}</strong> in this program. Ask an admin to publish
        one in Content Hub → Intake Forms.
      </Card>
    );
  }

  const alreadySigned = !!existing;

  return (
    <div className="space-y-5">
      {/* Form content */}
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          {isHouseRules ? "Read aloud with the participant" : "Form"}
        </p>
        <h2 className="text-lg font-semibold text-primary mb-3">{title}</h2>
        <div
          className={
            "text-sm text-foreground whitespace-pre-wrap max-h-72 overflow-y-auto pr-1 " +
            (isHouseRules ? "leading-relaxed" : "leading-normal")
          }
        >
          {template.content}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Version {template.version}
        </p>
      </Card>

      {/* Authorized contacts (disclosure_consent only) */}
      {isDisclosure && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Authorized contacts</p>
              <p className="text-xs text-muted-foreground">Up to 3 people the participant authorizes us to contact.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addContact}
              disabled={contacts.length >= 3 || alreadySigned}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contacts added yet. This is optional.</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Contact {idx + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContact(idx)}
                      disabled={alreadySigned}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Name"
                      value={c.name}
                      onChange={(e) => updateContact(idx, { name: e.target.value })}
                      disabled={alreadySigned}
                    />
                    <Input
                      placeholder="Relationship"
                      value={c.relationship}
                      onChange={(e) => updateContact(idx, { relationship: e.target.value })}
                      disabled={alreadySigned}
                    />
                    <Input
                      placeholder="Phone"
                      inputMode="tel"
                      value={c.phone}
                      onChange={(e) => updateContact(idx, { phone: e.target.value })}
                      disabled={alreadySigned}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Services consent initials */}
      {isServicesConsent && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Initial to acknowledge each service</p>
          <div className="space-y-2">
            {[
              { key: "peer_support" as const, label: "Peer Support Observation and Support Services" },
              { key: "assessments" as const, label: "Assessments" },
            ].map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() =>
                  !alreadySigned &&
                  setInitials((i) => ({ ...i, [row.key]: !i[row.key] }))
                }
                className={
                  "w-full flex items-center gap-3 border rounded-lg p-3 text-left transition-colors " +
                  (initials[row.key]
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40")
                }
                disabled={alreadySigned}
              >
                <div
                  className={
                    "h-10 w-10 rounded-md flex items-center justify-center text-sm font-bold " +
                    (initials[row.key]
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {initials[row.key] ? <Check className="h-4 w-4" /> : "___"}
                </div>
                <span className="text-sm text-foreground">{row.label}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Signatures */}
      <Card className="p-5 space-y-5">
        <SignatureCanvas
          sessionId={sessionId}
          formType={formType}
          role="participant"
          label="Participant signature"
          accepted={!!participantPath}
          acceptedPath={participantPath}
          onAccepted={setParticipantPath}
        />
        <div className="border-t border-border" />
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Witness (staff): {user?.email ?? "current user"}
          </p>
          <SignatureCanvas
            sessionId={sessionId}
            formType={formType}
            role="witness"
            label="Witness signature"
            accepted={!!witnessPath}
            acceptedPath={witnessPath}
            onAccepted={setWitnessPath}
          />
        </div>
      </Card>

      {alreadySigned ? (
        <Button
          className="w-full min-h-[52px] bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={onCompleted}
        >
          <Check className="h-4 w-4 mr-1" /> Already signed — Continue
        </Button>
      ) : (
        <Button
          className="w-full min-h-[52px] bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={!canContinue || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Saving…" : "Sign & Continue"}
        </Button>
      )}
    </div>
  );
}
