import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const PeerProfileSetup = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const canSubmit = firstName.trim() && lastName.trim() && bio.trim();

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

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);

    try {
      let photoUrl: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("peer_specialist_profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          bio: bio.trim(),
          specialties: specialties.length > 0 ? specialties : null,
          is_available: isAvailable,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Profile submitted! Your account is pending approval.");
      // Force reload to show pending approval screen
      window.location.reload();
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
          <CardTitle className="text-xl text-primary">
            Tell us about yourself
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your profile to begin the approval process.
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
            >
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoPreview || undefined} />
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
            <p className="text-xs text-muted-foreground">
              Tap to add a profile photo (optional)
            </p>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
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
            <p className="text-xs text-muted-foreground">
              2–4 sentences about your experience
            </p>
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

          {/* Availability */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Available to take new participants</p>
              <p className="text-xs text-muted-foreground">
                You can change this anytime
              </p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {saving ? "Submitting..." : "Submit for Approval"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PeerProfileSetup;
