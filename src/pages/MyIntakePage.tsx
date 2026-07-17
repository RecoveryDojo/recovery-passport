import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

const FORM_LABELS: Record<string, string> = {
  house_rules: "House Rules",
  disclosure_consent: "Consent to Disclose",
  belongings_consent: "Personal Belongings Consent",
  services_consent: "Consent for Services",
  liability_waiver: "Liability Waiver",
  non_tenancy: "Non-Tenancy Acknowledgement",
  contribution_agreement: "Contribution Agreement",
};

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default function MyIntakePage() {
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-intake", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("participant_profiles")
        .select("id, admission_date")
        .eq("user_id", user!.id)
        .single();
      if (!profile) return null;

      const { data: session } = await supabase
        .from("intake_sessions")
        .select("id, goal_1, goal_2, goal_3, room_note, completed_at")
        .eq("participant_id", profile.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!session) return { profile, session: null };

      const [sigsRes, contactsRes] = await Promise.all([
        supabase
          .from("intake_form_signatures")
          .select("id, form_type, template_id, signature_image_path, witness_signature_image_path, signed_at")
          .eq("intake_session_id", session.id),
        supabase
          .from("intake_authorized_contacts")
          .select("name, relationship, phone")
          .eq("intake_session_id", session.id),
      ]);

      const templateIds = Array.from(
        new Set((sigsRes.data ?? []).map((s) => s.template_id).filter(Boolean) as string[]),
      );
      const templatesById = new Map<string, { content: string; version: number }>();
      if (templateIds.length) {
        const { data: tpls } = await supabase
          .from("intake_form_templates")
          .select("id, content, version")
          .in("id", templateIds);
        (tpls ?? []).forEach((t) => templatesById.set(t.id, { content: t.content, version: t.version }));
      }

      const signatures = await Promise.all(
        (sigsRes.data ?? []).map(async (s) => ({
          ...s,
          template: s.template_id ? templatesById.get(s.template_id) : undefined,
          participantUrl: await signedUrl(s.signature_image_path),
          witnessUrl: await signedUrl(s.witness_signature_image_path),
        })),
      );

      // Preserve packet order
      const order = Object.keys(FORM_LABELS);
      signatures.sort((a, b) => order.indexOf(a.form_type) - order.indexOf(b.form_type));

      return {
        profile,
        session,
        signatures,
        contacts: contactsRes.data ?? [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.session) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto text-center space-y-3">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-semibold text-primary">No intake on file yet</h1>
        <p className="text-sm text-muted-foreground">
          Once your intake session is complete, you'll be able to review everything you signed and shared right here.
        </p>
      </div>
    );
  }

  const { profile, session, signatures, contacts } = data;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-primary">My Intake</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything you signed and shared when you joined the program.
        </p>
      </div>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Admission date</div>
        <div className="text-lg font-semibold text-foreground">
          {profile.admission_date
            ? format(parseISO(profile.admission_date), "MMMM d, yyyy")
            : "—"}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold">Signed forms</h2>
        <div className="divide-y">
          {signatures?.map((s) => {
            const open = openId === s.id;
            return (
              <div key={s.id} className="py-2">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {FORM_LABELS[s.form_type] ?? s.form_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Signed {format(parseISO(s.signed_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {open && (
                  <div className="mt-3 space-y-3">
                    {s.template?.content && (
                      <div className="text-xs whitespace-pre-wrap bg-secondary/40 rounded p-3 max-h-72 overflow-y-auto">
                        {s.template.content}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Your signature</div>
                        {s.participantUrl ? (
                          <img
                            src={s.participantUrl}
                            alt="Your signature"
                            className="border rounded bg-white w-full h-24 object-contain"
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">—</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Witness signature</div>
                        {s.witnessUrl ? (
                          <img
                            src={s.witnessUrl}
                            alt="Witness signature"
                            className="border rounded bg-white w-full h-24 object-contain"
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">—</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {contacts && contacts.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-semibold">Authorized contacts</h2>
          <div className="divide-y">
            {contacts.map((c, i) => (
              <div key={i} className="py-2 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.relationship, c.phone].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h2 className="text-sm font-semibold">Your three goals</h2>
        <ol className="list-decimal list-inside text-sm space-y-1">
          {[session.goal_1, session.goal_2, session.goal_3]
            .filter(Boolean)
            .map((g, i) => (
              <li key={i}>{g}</li>
            ))}
        </ol>
      </Card>

      {session.room_note && (
        <Card className="p-4 space-y-1">
          <h2 className="text-sm font-semibold">Room</h2>
          <p className="text-sm whitespace-pre-wrap">{session.room_note}</p>
        </Card>
      )}
    </div>
  );
}
