import { useState, useEffect } from "react";
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
import { CalendarIcon, X, ArrowLeft, Save, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type RecoveryPathway = Database["public"]["Enums"]["recovery_pathway"];

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

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [memberSince, setMemberSince] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date>();
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [recoveryStartDate, setRecoveryStartDate] = useState<Date>();
  const [substances, setSubstances] = useState<string[]>([]);
  const [customSubstance, setCustomSubstance] = useState("");
  const [pathway, setPathway] = useState("");
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [profileRes, programsRes, userRes] = await Promise.all([
        supabase.from("participant_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("programs").select("id, name"),
        supabase.from("users").select("phone, created_at").eq("id", user.id).single(),
      ]);

      if (programsRes.data) setPrograms(programsRes.data);
      if (userRes.data) {
        setPhone(userRes.data.phone || "");
        setMemberSince(format(parseISO(userRes.data.created_at), "MMMM yyyy"));
      }

      if (profileRes.data) {
        const p = profileRes.data;
        setFirstName(p.first_name);
        setLastName(p.last_name);
        if (p.date_of_birth) setDateOfBirth(parseISO(p.date_of_birth));
        setEmergencyName(p.emergency_contact_name || "");
        setEmergencyPhone(p.emergency_contact_phone || "");
        if (p.recovery_start_date) setRecoveryStartDate(parseISO(p.recovery_start_date));
        setSubstances(p.substances || []);
        setPathway(p.pathway || "");
        setProgramId(p.current_program_id || "");
      }

      setLoading(false);
    };

    load();
  }, [user]);

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

  const handleSave = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setSaving(true);

    try {
      if (phone.trim()) {
        await supabase.from("users").update({ phone: phone.trim() }).eq("id", user.id);
      }

      const { error } = await supabase
        .from("participant_profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : null,
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          recovery_start_date: recoveryStartDate ? format(recoveryStartDate, "yyyy-MM-dd") : null,
          substances: substances.length > 0 ? substances : null,
          pathway: (pathway as RecoveryPathway) || null,
          current_program_id: programId || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/card")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-primary">My Profile</h1>
      </div>

      {memberSince && (
        <p className="text-sm text-muted-foreground">Member since {memberSince}</p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-primary">About You</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name *</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name *</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date of birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateOfBirth && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateOfBirth ? format(dateOfBirth, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateOfBirth} onSelect={setDateOfBirth} disabled={(d) => d > new Date() || d < new Date("1920-01-01")} initialFocus className="p-3 pointer-events-auto" captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear()} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Emergency contact</Label>
              <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Phone" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-primary">Your Recovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Recovery start date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recoveryStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {recoveryStartDate ? format(recoveryStartDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={recoveryStartDate} onSelect={setRecoveryStartDate} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" captionLayout="dropdown-buttons" fromYear={1990} toYear={new Date().getFullYear()} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Substance(s)</Label>
            <div className="flex flex-wrap gap-2">
              {SUBSTANCE_OPTIONS.map((s) => (
                <Badge key={s} variant={substances.includes(s) ? "default" : "outline"} className={cn("cursor-pointer transition-colors", substances.includes(s) ? "bg-accent hover:bg-accent/80 text-accent-foreground" : "hover:bg-secondary")} onClick={() => toggleSubstance(s)}>
                  {s}
                </Badge>
              ))}
            </div>
            {substances.filter((s) => !SUBSTANCE_OPTIONS.includes(s)).map((s) => (
              <Badge key={s} className="bg-accent text-accent-foreground mr-1">
                {s}
                <button onClick={() => setSubstances((prev) => prev.filter((x) => x !== s))} className="ml-1"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            <div className="flex gap-2 mt-2">
              <Input value={customSubstance} onChange={(e) => setCustomSubstance(e.target.value)} placeholder="Add custom..." className="text-sm" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSubstance())} />
              <Button type="button" variant="outline" size="sm" onClick={addCustomSubstance} disabled={!customSubstance.trim()}>Add</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Recovery pathway</Label>
            <Select value={pathway} onValueChange={setPathway}>
              <SelectTrigger><SelectValue placeholder="Select pathway" /></SelectTrigger>
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
              <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      <div className="text-center pt-4">
        <button className="text-sm text-destructive hover:underline" onClick={() => toast.info("Account deletion coming soon")}>
          Delete My Account
        </button>
      </div>
    </div>
  );
};

export default Profile;
