import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
import { CalendarIcon, X, ArrowLeft, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUBSTANCE_OPTIONS = ["Alcohol", "Opioids", "Stimulants", "Cannabis", "Benzodiazepines", "Other"];
const PATHWAY_OPTIONS = [
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

const ProfileSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date>();
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Step 2 fields
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

  const canProceedStep1 = firstName.trim() && lastName.trim() && dateOfBirth;
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
    if (!user || !canSubmit || !canProceedStep1) return;
    setSaving(true);

    try {
      // Update phone on users table
      if (phone.trim()) {
        await supabase.from("users").update({ phone: phone.trim() }).eq("id", user.id);
      }

      // Update participant_profiles
      const { error } = await supabase
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
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile created! Welcome to Recovery Passport.");
      navigate("/card", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl text-primary">Let's set up your Recovery Passport</CardTitle>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">Step {step} of 2</p>
            <Progress value={step * 50} className="h-2" />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-primary">About You</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name *</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name *</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Date of birth *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateOfBirth && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
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

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emergencyName">Emergency contact</Label>
                  <Input id="emergencyName" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergencyPhone">Phone</Label>
                  <Input id="emergencyPhone" type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Phone" />
                </div>
              </div>

              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full bg-primary hover:bg-primary/90">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold text-primary">Your Recovery</h2>

              <div className="space-y-1.5">
                <Label>Recovery start date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recoveryStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
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

              <div className="space-y-1.5">
                <Label>Substance(s)</Label>
                <div className="flex flex-wrap gap-2">
                  {SUBSTANCE_OPTIONS.map((s) => (
                    <Badge
                      key={s}
                      variant={substances.includes(s) ? "default" : "outline"}
                      className={cn("cursor-pointer transition-colors", substances.includes(s) ? "bg-accent hover:bg-accent/80 text-accent-foreground" : "hover:bg-secondary")}
                      onClick={() => toggleSubstance(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
                {substances.filter((s) => !SUBSTANCE_OPTIONS.includes(s)).map((s) => (
                  <Badge key={s} className="bg-accent text-accent-foreground mr-1">
                    {s}
                    <button onClick={() => setSubstances((prev) => prev.filter((x) => x !== s))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex gap-2 mt-2">
                  <Input
                    value={customSubstance}
                    onChange={(e) => setCustomSubstance(e.target.value)}
                    placeholder="Add custom..."
                    className="text-sm"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSubstance())}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCustomSubstance} disabled={!customSubstance.trim()}>
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Recovery pathway</Label>
                <Select value={pathway} onValueChange={setPathway}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pathway" />
                  </SelectTrigger>
                  <SelectContent>
                    {PATHWAY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Current program</Label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit || saving} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                  {saving ? "Saving..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;
