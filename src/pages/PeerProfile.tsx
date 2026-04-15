import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, ArrowLeft, Save, AlertCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SPECIALTY_OPTIONS = [
  "Women's Recovery",
  "Men's Recovery",
  "Veterans",
  "Young Adults",
  "Spanish-Speaking",
  "MAT Pathway",
  "Dual Diagnosis",
  "Faith-Based",
  "LGBTQ+",
];

interface PeerProfileData {
  first_name: string;
  last_name: string;
  bio: string | null;
  specialties: string[] | null;
  is_available: boolean;
  photo_url: string | null;
  approval_status: string;
  pending_edits: Record<string, unknown> | null;
}

const PeerProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [hasPendingEdits, setHasPendingEdits] = useState(false);

  // Store original values for approved peers to detect changes
  const [originalBio, setOriginalBio] = useState("");
  const [originalSpecialties, setOriginalSpecialties] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name, bio, specialties, is_available, photo_url, approval_status, pending_edits")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const d = data as PeerProfileData;
        setFirstName(d.first_name);
        setLastName(d.last_name);
        setBio(d.bio || "");
        setSpecialties(d.specialties || []);
        setIsAvailable(d.is_available);
        setPhotoUrl(d.photo_url);
        setIsApproved(d.approval_status === "approved");
        setHasPendingEdits(!!d.pending_edits);
        setOriginalBio(d.bio || "");
        setOriginalSpecialties(d.specialties || []);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setSaving(true);

    try {
      let newPhotoUrl = photoUrl;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        newPhotoUrl = urlData.publicUrl;
      }

      if (isApproved) {
        // For approved peers: check if bio or specialties changed
        const bioChanged = bio.trim() !== originalBio;
        const specialtiesChanged =
          JSON.stringify([...specialties].sort()) !==
          JSON.stringify([...originalSpecialties].sort());

        // Build pending_edits if bio or specialties changed
        const pendingEdits = (bioChanged || specialtiesChanged)
          ? {
              ...(bioChanged ? { bio: bio.trim() } : {}),
              ...(specialtiesChanged ? { specialties: specialties.length > 0 ? specialties : null } : {}),
            }
          : undefined;

        const { error } = await supabase
          .from("peer_specialist_profiles")
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            is_available: isAvailable,
            ...(newPhotoUrl !== photoUrl ? { photo_url: newPhotoUrl } : {}),
            ...(pendingEdits ? { pending_edits: pendingEdits } : {}),
          })
          .eq("user_id", user.id);

        if (error) throw error;

        if (bioChanged || specialtiesChanged) {
          setHasPendingEdits(true);
          toast.success("Profile updated. Bio/specialty changes are pending admin review.");
        } else {
          toast.success("Profile updated");
        }
      } else {
        // Not yet approved — save directly
        const { error } = await supabase
          .from("peer_specialist_profiles")
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            bio: bio.trim(),
            specialties: specialties.length > 0 ? specialties : null,
            is_available: isAvailable,
            ...(newPhotoUrl ? { photo_url: newPhotoUrl } : {}),
          })
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Profile updated");
      }
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

  const displayPhoto = photoPreview || photoUrl;

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/caseload")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-primary">My Profile</h1>
      </div>

      {hasPendingEdits && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your changes are pending admin review before they go live.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-primary">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
            >
              <Avatar className="h-20 w-20">
                <AvatarImage src={displayPhoto || undefined} />
                <AvatarFallback className="bg-secondary text-muted-foreground text-lg">
                  {firstName ? firstName[0]?.toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio *</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell participants about your recovery experience and approach."
              rows={4}
            />
          </div>

          {/* Specialties */}
          <div className="space-y-1.5">
            <Label>Specialties</Label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((s) => (
                <Badge
                  key={s}
                  variant={specialties.includes(s) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    specialties.includes(s)
                      ? "bg-accent hover:bg-accent/80 text-accent-foreground"
                      : "hover:bg-secondary"
                  )}
                  onClick={() => toggleSpecialty(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Available to take new participants</p>
              <p className="text-xs text-muted-foreground">
                Controls whether participants can request you
              </p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      <Button
        variant="outline"
        onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
        className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
};

export default PeerProfile;
