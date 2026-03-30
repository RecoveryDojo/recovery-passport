import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"participant" | "peer_specialist">("participant");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && role) {
    const home = role === "participant" ? "/card" : role === "peer_specialist" ? "/caseload" : "/admin";
    return <Navigate to={home} replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: selectedRole } },
    });
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a confirmation link. Please verify your email to sign in." });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Recovery Passport</h1>
          <p className="text-muted-foreground mt-2 text-sm">Create your account</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold text-card-foreground text-center">Sign Up</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
              </div>
              <div className="space-y-3">
                <Label>I am a…</Label>
                <RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as "participant" | "peer_specialist")} className="flex flex-col gap-3">
                  <div className="flex items-center space-x-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRole("participant")}>
                    <RadioGroupItem value="participant" id="participant" />
                    <Label htmlFor="participant" className="cursor-pointer font-normal">
                      <span className="font-medium">Participant</span>
                      <span className="block text-xs text-muted-foreground">Person in recovery</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRole("peer_specialist")}>
                    <RadioGroupItem value="peer_specialist" id="peer_specialist" />
                    <Label htmlFor="peer_specialist" className="cursor-pointer font-normal">
                      <span className="font-medium">Peer Specialist</span>
                      <span className="block text-xs text-muted-foreground">Recovery peer specialist</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creating account…" : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">Already have an account? Sign in</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
