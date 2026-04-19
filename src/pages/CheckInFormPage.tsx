import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLogCheckIn } from "@/hooks/use-log-checkin";
import type { Database } from "@/integrations/supabase/types";

type ContactMode = Database["public"]["Enums"]["checkin_contact_mode"];

const MOOD_OPTIONS = [
  { value: 1, label: "Crisis", color: "bg-red-500 hover:bg-red-600 text-white" },
  { value: 2, label: "Struggling", color: "bg-orange-500 hover:bg-orange-600 text-white" },
  { value: 3, label: "Getting By", color: "bg-amber-500 hover:bg-amber-600 text-white" },
  { value: 4, label: "Good", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  { value: 5, label: "Thriving", color: "bg-green-600 hover:bg-green-700 text-white" },
];

const CONTACT_MODES: { value: ContactMode; label: string }[] = [
  { value: "in_person", label: "In-person" },
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text" },
  { value: "app_message", label: "App message" },
  { value: "no_contact", label: "No contact made" },
];

const CheckInFormPage = () => {
  const { participantId } = useParams<{ participantId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [contactMode, setContactMode] = useState<ContactMode | "">("");
  const [notes, setNotes] = useState("");
  const [discussedPlan, setDiscussedPlan] = useState<boolean | null>(null);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["participant-checkin-profile", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("first_name, last_name")
        .eq("id", participantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const fullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "";

  const mutation = useLogCheckIn({
    onSuccess: () => {
      toast.success("Check-in saved");
      navigate("/caseload");
    },
    onError: (err) => toast.error(err.message || "Failed to save check-in"),
  });

  const handleSubmit = () => {
    if (!user || !participantId) return;
    if (!moodScore || !contactMode || discussedPlan === null) {
      toast.error("Please complete all required fields");
      return;
    }
    mutation.mutate({
      participantId,
      participantName: fullName || "Participant",
      peerSpecialistId: user.id,
      moodScore,
      contactMode: contactMode as ContactMode,
      notes,
      discussedPlan,
    });
  };

  return (
    <div className="px-4 pt-4 pb-8 max-w-lg mx-auto space-y-6">
      <Link
        to="/caseload"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to caseload
      </Link>

      <div>
        <h1 className="text-xl font-bold text-foreground">
          {loadingProfile
            ? "Logging check-in…"
            : `Logging check-in for ${fullName || "Participant"}`}
        </h1>
      </div>

      {/* Mood */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Mood score <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-2">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMoodScore(opt.value)}
              className={cn(
                "flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all",
                moodScore === opt.value
                  ? `${opt.color} ring-2 ring-offset-2 ring-foreground/20`
                  : "bg-muted text-foreground hover:bg-muted/70",
              )}
            >
              <span>
                {opt.value} — {opt.label}
              </span>
              {moodScore === opt.value && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Contact mode */}
      <div className="space-y-2">
        <Label htmlFor="contact-mode" className="text-sm font-medium">
          Mode of contact <span className="text-destructive">*</span>
        </Label>
        <Select
          value={contactMode}
          onValueChange={(v) => setContactMode(v as ContactMode)}
        >
          <SelectTrigger id="contact-mode">
            <SelectValue placeholder="Select how you connected" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          Notes{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          maxLength={500}
          placeholder="Optional: brief notes about this check-in"
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground text-right">
          {notes.length}/500
        </p>
      </div>

      {/* Discussed plan */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Did you discuss their recovery plan?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={discussedPlan === true ? "default" : "outline"}
            onClick={() => setDiscussedPlan(true)}
            className={discussedPlan === true ? "bg-primary hover:bg-primary/90" : ""}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={discussedPlan === false ? "default" : "outline"}
            onClick={() => setDiscussedPlan(false)}
            className={discussedPlan === false ? "bg-primary hover:bg-primary/90" : ""}
          >
            No
          </Button>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={
          mutation.isPending ||
          !moodScore ||
          !contactMode ||
          discussedPlan === null
        }
        className="w-full bg-primary hover:bg-primary/90"
        size="lg"
      >
        {mutation.isPending ? "Saving…" : "Save Check-In"}
      </Button>
    </div>
  );
};

export default CheckInFormPage;
