import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};

// Beta API not yet typed on supabase-js
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
    approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
    denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  };
}).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader><h1 className="text-lg font-semibold text-primary">Authorization error</h1></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{error}</p></CardContent>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "an external app";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <h1 className="text-xl font-semibold text-primary">Connect {clientName} to Recovery Passport</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {clientName} is requesting access to your Recovery Passport account. It will be able to
            act as you — reading your card, milestones, check-ins, and plan, and logging self-care
            checks on your behalf.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy ? "Working…" : `Approve ${clientName}`}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Deny
          </Button>
          <p className="text-xs text-muted-foreground pt-2">
            You can revoke access at any time from your account settings.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
