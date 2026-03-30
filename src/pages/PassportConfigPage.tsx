import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link2, Lock, Copy, ExternalLink } from "lucide-react";

const SECTION_DEFAULTS = [
  { key: "milestones", label: "Milestones", defaultOn: true, locked: false },
  { key: "rc_score_trend", label: "Recovery Capital Score Trend", defaultOn: true, locked: false },
  { key: "current_program", label: "Current Program", defaultOn: true, locked: false },
  { key: "peer_verifications", label: "Peer Specialist Verifications", defaultOn: true, locked: false },
  { key: "checkin_history", label: "Check-In History", defaultOn: false, locked: false },
  { key: "plan_progress", label: "Recovery Plan Progress", defaultOn: false, locked: false },
  { key: "payment_history", label: "Payment History", defaultOn: false, locked: true },
];

const EXPIRY_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "No expiration", hours: null },
];

function generateToken(length = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

const PassportConfigPage = () => {
  const { user } = useAuth();

  // Form state
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SECTION_DEFAULTS.forEach((s) => {
      init[s.key] = s.locked ? false : s.defaultOn;
    });
    return init;
  });
  const [expiryHours, setExpiryHours] = useState<number | null>(168); // 7 days default
  const [ackChecked, setAckChecked] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Profile ID
  const { data: profileId } = useQuery({
    queryKey: ["my-profile-id-passport", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      return data?.id ?? null;
    },
  });

  // CFR42 texts
  const { data: cfr42Preamble } = useQuery({
    queryKey: ["cfr42-preamble"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "cfr42_consent_preamble")
        .single();
      return data?.value ?? "";
    },
  });

  const { data: cfr42Redisclosure } = useQuery({
    queryKey: ["cfr42-redisclosure"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "cfr42_redisclosure_notice")
        .single();
      return data?.value ?? "";
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !user) throw new Error("Not authenticated");

      const token = generateToken();
      const visibleSections = { ...sections };
      const expiresAt = expiryHours
        ? new Date(Date.now() + expiryHours * 3600000).toISOString()
        : null;

      // Insert shared link
      const { data: link, error: linkErr } = await supabase
        .from("shared_links")
        .insert({
          participant_id: profileId,
          token,
          visible_sections: visibleSections,
          expires_at: expiresAt,
          is_revoked: false,
        })
        .select("id")
        .single();
      if (linkErr) throw linkErr;

      // Insert consent record
      const { error: consentErr } = await supabase
        .from("consent_records")
        .insert({
          participant_id: profileId,
          shared_link_id: link.id,
          recipient_description: recipient.trim(),
          purpose: purpose.trim(),
          sections_disclosed: visibleSections,
        });
      if (consentErr) throw consentErr;

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "generate_passport_link",
        target_type: "shared_links",
        target_id: link.id,
      });

      return token;
    },
    onSuccess: (token) => {
      const url = `${window.location.origin}/passport/${token}`;
      setGeneratedUrl(url);
      toast.success("Passport link generated");
    },
    onError: () => toast.error("Failed to generate link"),
  });

  const canGenerate =
    recipient.trim().length > 0 &&
    purpose.trim().length > 0 &&
    ackChecked &&
    !generateMutation.isPending;

  // Success screen
  if (generatedUrl) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-5">
        <h1 className="text-xl font-bold text-foreground">Link Generated ✓</h1>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Share this link with <span className="font-medium text-foreground">{recipient}</span>
          </p>
          <div className="bg-muted rounded-lg p-3 text-xs font-mono break-all text-foreground">
            {generatedUrl}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(generatedUrl);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(generatedUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Preview
            </Button>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setGeneratedUrl(null);
            setRecipient("");
            setPurpose("");
            setAckChecked(false);
            setSections(() => {
              const init: Record<string, boolean> = {};
              SECTION_DEFAULTS.forEach((s) => {
                init[s.key] = s.locked ? false : s.defaultOn;
              });
              return init;
            });
          }}
        >
          Generate Another Link
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-5 w-5 text-accent" />
          Share Your Recovery Passport
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a link anyone can view. You control what they see.
        </p>
      </div>

      {/* Step 1: CFR42 Preamble */}
      {cfr42Preamble && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap">{cfr42Preamble}</p>
        </div>
      )}

      {/* Step 2: Consent Fields */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="recipient" className="text-sm font-medium">
            Who are you sharing with? <span className="text-red-500">*</span>
          </Label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="e.g. Judge Adams, Housing Authority, Employer Name"
            className="mt-1"
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="purpose" className="text-sm font-medium">
            Why are you sharing? <span className="text-red-500">*</span>
          </Label>
          <Input
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Verify recovery progress for housing application"
            className="mt-1"
            maxLength={300}
          />
        </div>
      </div>

      {/* Step 3: Section Toggles */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Include in Passport</p>
        {SECTION_DEFAULTS.map((sec) => (
          <div
            key={sec.key}
            className="flex items-center justify-between py-2 px-3 bg-card border border-border rounded-lg"
          >
            <span className="text-sm text-foreground flex items-center gap-2">
              {sec.label}
              {sec.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </span>
            {sec.locked ? (
              <span className="text-xs text-muted-foreground italic">Always private</span>
            ) : (
              <Switch
                checked={sections[sec.key]}
                onCheckedChange={(checked) =>
                  setSections((prev) => ({ ...prev, [sec.key]: checked }))
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 4: Expiry */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Link Expiration</p>
        <div className="grid grid-cols-2 gap-2">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setExpiryHours(opt.hours)}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                expiryHours === opt.hours
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-foreground hover:border-accent/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 5: Re-disclosure */}
      {cfr42Redisclosure && (
        <div className="space-y-3">
          <div className="border-2 border-border rounded-xl p-4 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Re-Disclosure Notice
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{cfr42Redisclosure}</p>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="ack"
              checked={ackChecked}
              onCheckedChange={(v) => setAckChecked(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="ack" className="text-sm text-foreground leading-snug cursor-pointer">
              I have read and understand this re-disclosure notice. I understand this information
              may not be re-disclosed without my written consent.
            </Label>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={() => generateMutation.mutate()}
        disabled={!canGenerate}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold py-5 text-base"
      >
        {generateMutation.isPending ? "Generating…" : "Generate Link"}
      </Button>
    </div>
  );
};

export default PassportConfigPage;
