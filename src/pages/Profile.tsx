import { useState, useEffect, useRef } from "react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon, X, ArrowLeft, Save, LogOut, Camera, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
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

/** Amber border wrapper for fields that are empty / missing */
const MissingFieldHint = ({ show, children }: { show: boolean; children: React.ReactNode }) => {
  if (!show) return <>{children}</>;
  return (
    <div className="relative">
      <div className="rounded-lg border-2 border-accent/60 p-0.5">
        {children}
      </div>
      <span className="flex items-center gap-1 text-xs text-accent mt-1">
        <AlertCircle className="h-3 w-3" /> Add this info →
      </span>
    </div>
  );
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

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
        setPhotoUrl(p.photo_url || null);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("participant_profiles")
        .update({ photo_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setPhotoUrl(publicUrl);
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const initials = (firstName?.[0] ?? "") + (lastName?.[0] ?? "");
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "New Player";
  const daysInRecovery = recoveryStartDate ? differenceInDays(new Date(), recoveryStartDate) : null;
  const programName = programs.find((p) => p.id === programId)?.name;

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/card")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-primary">My Profile</h1>
      </div>

      {/* Avatar + Days Counter */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <Avatar className="h-24 w-24 border-4 border-accent/30">
              {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
            {uploadingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
        <p className="text-sm text-muted-foreground">Tap to change photo</p>

        {daysInRecovery != null && daysInRecovery >= 0 ? (
          <div className="bg-primary/10 rounded-xl px-6 py-3 text-center">
            <p className="text-3xl font-bold text-primary">{daysInRecovery}</p>
            <p className="text-xs text-muted-foreground mt-0.5">days in recovery</p>
          </div>
        ) : (
          <div className="bg-accent/10 rounded-xl px-6 py-3 text-center">
            <p className="text-sm text-accent font-medium">Set your recovery start date below to see your day count</p>
          </div>
        )}
      </div>

      {memberSince && (
        <p className="text-sm text-muted-foreground text-center">Member since {memberSince}</p>
      )}

      {/* About You */}
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

          <MissingFieldHint show={!dateOfBirth}>
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
          </MissingFieldHint>

          <MissingFieldHint show={!phone.trim()}>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </MissingFieldHint>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>

          <MissingFieldHint show={!emergencyName.trim() && !emergencyPhone.trim()}>
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
          </MissingFieldHint>
        </CardContent>
      </Card>

      {/* Your Recovery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-primary">Your Recovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MissingFieldHint show={!recoveryStartDate}>
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
          </MissingFieldHint>

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
            <Input value={programName || "No program assigned"} disabled className="bg-muted" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      <Button variant="outline" onClick={signOut} className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>

      <div className="text-center pt-2">
        <button className="text-sm text-destructive/60 hover:underline" onClick={() => toast.info("Account deletion coming soon")}>
          Delete My Account
        </button>
      </div>
    </div>
  );
};

export default Profile;
