import { useState, useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, X, ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUBSTANCE_OPTIONS = ["Alcohol", "Opioids", "Stimulants", "Cannabis", "Benzodiazepines", "Other"];
const PATHWAY_OPTIONS: { value: Database["public"]["Enums"]["recovery_pathway"]; label: string }[] = [
  { value: "twelve_step", label: "12-Step" },
  { value: "mat", label: "MAT (Medication-Assisted Treatment)" },
  { value: "faith_based", label: "Faith-Based" },
  { value: "holistic", label: "Holistic" },
  { value: "other", label: "Other" },
];

interface Program {
  id: string;
  name: string;
}

const IntakePage = () => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  // Step 1 — Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — About You
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date>();
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Step 3 — Recovery
  const [recoveryStartDate, setRecoveryStartDate] = useState<Date>();
  const [substances, setSubstances] = useState<string[]>([]);
  const [customSubstance, setCustomSubstance] = useState("");
  const [pathway, setPathway] = useState("");
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    supabase.from("programs").select("id, name").then(({ data }) => {
      if (data) setPrograms(data);
    });
  }, []);

  const canProceedStep1 = email.trim().includes("@") && password.length >= 6;
  const canProceedStep2 = firstName.trim() && lastName.trim() && dateOfBirth;
  const canSubmit = recoveryStartDate;

  const toggleSubstance = (s: string) => {
    setSubstances((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const addCustomSubstance = () => {
    const trimmed = customSubstance.trim();
    if (trimmed && !substances.includes(trimmed)) {
      setSubstances((prev) => [...prev, trimmed]);
      setCustomSubstance("");
    }
  };

  const handleSubmit = async () => {
    if (!canProceedStep1 || !canProceedStep2 || !canSubmit) return;
    setSaving(true);

    try {
      // 1. Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role: "participant" } },
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Signup failed — no user returned.");

      // 2. Update phone on users table
      if (phone.trim()) {
        await supabase.from("users").update({ phone: phone.trim() }).eq("id", userId);
      }

      // 3. Update participant_profiles (auto-created by trigger)
      const { error: profileError } = await supabase
        .from("participant_profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: format(dateOfBirth!, "yyyy-MM-dd"),
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          recovery_start_date: format(recoveryStartDate!, "yyyy-MM-dd"),
          substances: substances.length > 0 ? substances : null,
          pathway: (pathway as Database["public"]["Enums"]["recovery_pathway"]) || null,
          current_program_id: programId || null,
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // 4. Sign out so the tablet is ready for the next person
      await supabase.auth.signOut();

      setComplete(true);
      toast.success("Intake complete!");
    } catch (err: any) {
      toast.error(err.message || "Failed to complete intake");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setComplete(false);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setDateOfBirth(undefined);
    setPhone("");
    setEmergencyName("");
    setEmergencyPhone("");
    setRecoveryStartDate(undefined);
    setSubstances([]);
    setCustomSubstance("");
    setPathway("");
    setProgramId("");
  };

  if (complete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="py-12 space-y-6">
            <CheckCircle2 className="h-16 w-16 text-accent mx-auto" />
            <h1 className="text-3xl font-bold text-primary">Welcome to Recovery Passport!</h1>
            <p className="text-lg text-muted-foreground">
              Your account has been created. Check your email to verify, then log in from your own device.
            </p>
            <Button
              onClick={resetForm}
              size="lg"
              className="min-h-[56px] text-lg px-8"
            >
              <RotateCcw className="mr-2 h-5 w-5" /> Start Next Intake
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-6 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl md:text-3xl text-primary">Walk-In Intake</CardTitle>
          <p className="text-base text-muted-foreground mt-1">Recovery Passport enrollment</p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">Step {step} of 3</p>
            <Progress value={Math.round((step / 3) * 100)} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* ── Step 1: Account ─────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-xl text-primary">Create Account</h2>

              <div className="space-y-2">
                <Label htmlFor="intake-email" className="text-base">Email *</Label>
                <Input
                  id="intake-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="min-h-[56px] text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intake-password" className="text-base">Password * (6+ characters)</Label>
                <Input
                  id="intake-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="min-h-[56px] text-lg"
                />
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full min-h-[56px] text-lg"
              >
                Next <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* ── Step 2: About You ──────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-xl text-primary">About You</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intake-first" className="text-base">First name *</Label>
                  <Input
                    id="intake-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="min-h-[56px] text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intake-last" className="text-base">Last name *</Label>
                  <Input
                    id="intake-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="min-h-[56px] text-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Date of birth *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal min-h-[56px] text-lg",
                        !dateOfBirth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-5 w-5" />
                      {dateOfBirth ? format(dateOfBirth, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateOfBirth}
                      onSelect={setDateOfBirth}
                      disabled={(d) => d > new Date() || d < new Date("1920-01-01")}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      captionLayout="dropdown-buttons"
                      fromYear={1920}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intake-phone" className="text-base">Phone number</Label>
                <Input
                  id="intake-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="min-h-[56px] text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intake-em-name" className="text-base">Emergency contact</Label>
                  <Input
                    id="intake-em-name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Name"
                    className="min-h-[56px] text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intake-em-phone" className="text-base">Phone</Label>
                  <Input
                    id="intake-em-phone"
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="Phone"
                    className="min-h-[56px] text-lg"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 min-h-[56px] text-lg"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="flex-1 min-h-[56px] text-lg"
                >
                  Next <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Recovery ───────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-xl text-primary">Your Recovery</h2>

              <div className="space-y-2">
                <Label className="text-base">Recovery start date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal min-h-[56px] text-lg",
                        !recoveryStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-5 w-5" />
                      {recoveryStartDate ? format(recoveryStartDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={recoveryStartDate}
                      onSelect={setRecoveryStartDate}
                      disabled={(d) => d > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      captionLayout="dropdown-buttons"
                      fromYear={1990}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Substance(s)</Label>
                <div className="flex flex-wrap gap-3">
                  {SUBSTANCE_OPTIONS.map((s) => (
                    <Badge
                      key={s}
                      variant={substances.includes(s) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-colors min-h-[44px] px-4 text-base",
                        substances.includes(s)
                          ? "bg-accent hover:bg-accent/80 text-accent-foreground"
                          : "hover:bg-secondary"
                      )}
                      onClick={() => toggleSubstance(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
                {substances.filter((s) => !SUBSTANCE_OPTIONS.includes(s)).map((s) => (
                  <Badge key={s} className="bg-accent text-accent-foreground mr-1 min-h-[44px] px-4 text-base">
                    {s}
                    <button onClick={() => setSubstances((prev) => prev.filter((x) => x !== s))} className="ml-2 p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </Badge>
                ))}
                <div className="flex gap-3 mt-2">
                  <Input
                    value={customSubstance}
                    onChange={(e) => setCustomSubstance(e.target.value)}
                    placeholder="Add custom..."
                    className="min-h-[56px] text-lg"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSubstance())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomSubstance}
                    disabled={!customSubstance.trim()}
                    className="min-h-[56px] text-lg px-6"
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Recovery pathway</Label>
                <Select value={pathway} onValueChange={setPathway}>
                  <SelectTrigger className="min-h-[56px] text-lg">
                    <SelectValue placeholder="Select pathway" />
                  </SelectTrigger>
                  <SelectContent>
                    {PATHWAY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-base py-3">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Current program</Label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger className="min-h-[56px] text-lg">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-base py-3">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 min-h-[56px] text-lg"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || saving}
                  className="flex-1 min-h-[56px] text-lg bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {saving ? "Enrolling..." : "Complete Intake"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntakePage;
