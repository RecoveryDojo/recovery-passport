import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Link2, Lock, Copy, Share2, Download, XCircle } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { format, formatDistanceToNow, isPast } from "date-fns";

const SECTION_DEFAULTS = [
  { key: "milestones", label: "Milestones", defaultOn: true, locked: false },
  { key: "rc_score_trend", label: "RC Score Trend", defaultOn: true, locked: false },
  { key: "current_program", label: "Current Program", defaultOn: true, locked: false },
  { key: "peer_verifications", label: "Peer Verifications", defaultOn: true, locked: false },
  { key: "checkin_history", label: "Check-In History", defaultOn: false, locked: false },
  { key: "plan_progress", label: "Plan Progress", defaultOn: false, locked: false },
  { key: "payment_history", label: "Payment History", defaultOn: false, locked: true },
];

const SECTION_LABEL_MAP: Record<string, string> = {};
SECTION_DEFAULTS.forEach((s) => { SECTION_LABEL_MAP[s.key] = s.label; });

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

function getInitialSections() {
  const init: Record<string, boolean> = {};
  SECTION_DEFAULTS.forEach((s) => { init[s.key] = s.locked ? false : s.defaultOn; });
  return init;
}

const PassportConfigPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [sections, setSections] = useState<Record<string, boolean>>(getInitialSections);
  const [expiryHours, setExpiryHours] = useState<number | null>(168);
  const [ackChecked, setAckChecked] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedRecipient, setGeneratedRecipient] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

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

  const { data: cfr42Preamble } = useQuery({
    queryKey: ["cfr42-preamble"],
    queryFn: async () => {
      const { data } = await supabase.from("app_config").select("value").eq("key", "cfr42_consent_preamble").single();
      return data?.value ?? "";
    },
  });

  const { data: cfr42Redisclosure } = useQuery({
    queryKey: ["cfr42-redisclosure"],
    queryFn: async () => {
      const { data } = await supabase.from("app_config").select("value").eq("key", "cfr42_redisclosure_notice").single();
      return data?.value ?? "";
    },
  });

  // Active links
  const { data: sharedLinks = [] } = useQuery({
    queryKey: ["my-shared-links", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_links")
        .select("*")
        .eq("participant_id", profileId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !user) throw new Error("Not authenticated");
      const token = generateToken();
      const visibleSections = { ...sections };
      const expiresAt = expiryHours ? new Date(Date.now() + expiryHours * 3600000).toISOString() : null;

      const { data: link, error: linkErr } = await supabase
        .from("shared_links")
        .insert({ participant_id: profileId, token, visible_sections: visibleSections, expires_at: expiresAt, is_revoked: false })
        .select("id")
        .single();
      if (linkErr) throw linkErr;

      await supabase.from("consent_records").insert({
        participant_id: profileId, shared_link_id: link.id,
        recipient_description: recipient.trim(), purpose: purpose.trim(),
        sections_disclosed: visibleSections,
      });

      await supabase.from("audit_log").insert({
        user_id: user.id, action: "generate_passport_link",
        target_type: "shared_links", target_id: link.id,
      });

      return token;
    },
    onSuccess: (token) => {
      const url = `${window.location.origin}/passport/${token}`;
      setGeneratedUrl(url);
      setGeneratedRecipient(recipient);
      toast.success("Passport link generated");
      queryClient.invalidateQueries({ queryKey: ["my-shared-links"] });
    },
    onError: () => toast.error("Failed to generate link"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("shared_links")
        .update({ is_revoked: true })
        .eq("id", linkId);
      if (error) throw error;

      await supabase.from("audit_log").insert({
        user_id: user!.id, action: "revoke_passport_link",
        target_type: "shared_links", target_id: linkId,
      });
    },
    onSuccess: () => {
      toast.success("Link revoked");
      queryClient.invalidateQueries({ queryKey: ["my-shared-links"] });
    },
    onError: () => toast.error("Failed to revoke link"),
  });

  const canGenerate = recipient.trim().length > 0 && purpose.trim().length > 0 && ackChecked && !generateMutation.isPending;

  const handleCopy = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
  }, []);

  const handleShare = useCallback(async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Recovery Passport", url });
      } catch { /* user cancelled */ }
    } else {
      handleCopy(url);
    }
  }, [handleCopy]);

  const handleDownloadQR = useCallback(() => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "recovery-passport-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const resetForm = () => {
    setGeneratedUrl(null);
    setGeneratedRecipient("");
    setRecipient("");
    setPurpose("");
    setAckChecked(false);
    setSections(getInitialSections());
  };

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

      {/* Generated link result */}
      {generatedUrl && (
        <div className="bg-card border-2 border-accent/30 rounded-xl p-5 space-y-4">
          <p className="text-sm font-medium text-foreground">
            Link for <span className="text-accent">{generatedRecipient}</span>
          </p>

          {/* QR Code */}
          <div ref={qrRef} className="flex justify-center">
            <QRCodeCanvas value={generatedUrl} size={180} level="M" includeMargin />
          </div>

          {/* URL */}
          <div className="bg-muted rounded-lg p-3 text-xs font-mono break-all text-foreground">
            {generatedUrl}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => handleCopy(generatedUrl)}>
              <Copy className="h-4 w-4 mr-1" /> Copy Link
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleShare(generatedUrl)}>
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadQR}>
              <Download className="h-4 w-4 mr-1" /> Download QR
            </Button>
          </div>

          <Button variant="outline" className="w-full" onClick={resetForm}>
            Generate Another Link
          </Button>
        </div>
      )}

      {/* Generator form (hidden after generation, shown again via "Generate Another") */}
      {!generatedUrl && (
        <>
          {cfr42Preamble && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">{cfr42Preamble}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label htmlFor="recipient" className="text-sm font-medium">
                Who are you sharing with? <span className="text-red-500">*</span>
              </Label>
              <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Judge Adams, Housing Authority, Employer Name" className="mt-1" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="purpose" className="text-sm font-medium">
                Why are you sharing? <span className="text-red-500">*</span>
              </Label>
              <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Verify recovery progress for housing application" className="mt-1" maxLength={300} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Include in Passport</p>
            {SECTION_DEFAULTS.map((sec) => (
              <div key={sec.key} className="flex items-center justify-between py-2 px-3 bg-card border border-border rounded-lg">
                <span className="text-sm text-foreground flex items-center gap-2">
                  {sec.label}
                  {sec.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
                {sec.locked ? (
                  <span className="text-xs text-muted-foreground italic">Always private</span>
                ) : (
                  <Switch checked={sections[sec.key]}
                    onCheckedChange={(checked) => setSections((prev) => ({ ...prev, [sec.key]: checked }))} />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Link Expiration</p>
            <div className="grid grid-cols-2 gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button key={opt.label} onClick={() => setExpiryHours(opt.hours)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    expiryHours === opt.hours
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-foreground hover:border-accent/50"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {cfr42Redisclosure && (
            <div className="space-y-3">
              <div className="border-2 border-border rounded-xl p-4 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Re-Disclosure Notice
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{cfr42Redisclosure}</p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="ack" checked={ackChecked} onCheckedChange={(v) => setAckChecked(v === true)} className="mt-0.5" />
                <Label htmlFor="ack" className="text-sm text-foreground leading-snug cursor-pointer">
                  I have read and understand this re-disclosure notice. I understand this information
                  may not be re-disclosed without my written consent.
                </Label>
              </div>
            </div>
          )}

          <Button onClick={() => generateMutation.mutate()} disabled={!canGenerate}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold py-5 text-base">
            {generateMutation.isPending ? "Generating…" : "Generate Link"}
          </Button>
        </>
      )}

      {/* Active Links List */}
      {sharedLinks.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold text-foreground">Your Shared Links</h2>
          {sharedLinks.map((link) => {
            const isExpired = link.expires_at && isPast(new Date(link.expires_at));
            const isRevoked = link.is_revoked;
            const isActive = !isExpired && !isRevoked;
            const visibleSections = (link.visible_sections as Record<string, boolean>) ?? {};
            const enabledSections = Object.entries(visibleSections)
              .filter(([, v]) => v)
              .map(([k]) => SECTION_LABEL_MAP[k] || k);

            let statusBadge: React.ReactNode;
            if (isRevoked) {
              statusBadge = <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">Revoked</Badge>;
            } else if (isExpired) {
              statusBadge = <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">Expired</Badge>;
            } else {
              statusBadge = <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px]">Active</Badge>;
            }

            let expiryText: string;
            if (!link.expires_at) {
              expiryText = "No expiration";
            } else if (isExpired) {
              expiryText = `Expired ${format(new Date(link.expires_at), "MMM d, yyyy")}`;
            } else {
              expiryText = `Expires ${formatDistanceToNow(new Date(link.expires_at), { addSuffix: true })}`;
            }

            return (
              <div key={link.id} className={`bg-card border border-border rounded-xl p-4 space-y-2 ${!isActive ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusBadge}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(link.created_at), "MMM d, yyyy · h:mm a")}
                    </span>
                  </div>
                  {isActive && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2">
                          <XCircle className="h-4 w-4 mr-1" /> Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This link will stop working immediately for anyone who has it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => revokeMutation.mutate(link.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Revoke Link
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{expiryText}</p>

                {enabledSections.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {enabledSections.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                {isActive && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => handleCopy(`${window.location.origin}/passport/${link.token}`)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy Link
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PassportConfigPage;
