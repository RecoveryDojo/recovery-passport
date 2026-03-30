import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && role) {
    const home = role === "participant" ? "/card" : role === "peer_specialist" ? "/caseload" : "/admin";
    return <Navigate to={home} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Recovery Passport</h1>
          <p className="text-muted-foreground mt-2 text-sm">Your recovery. Your record. Your future.</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold text-card-foreground text-center">Sign In</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center space-y-2 text-sm">
              <Link to="/forgot-password" className="block text-primary hover:underline">Forgot password?</Link>
              <Link to="/signup" className="block text-primary hover:underline">Create an account</Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link to="/intake" className="text-sm text-accent hover:underline font-medium">
            Walk-in intake? Start here →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
