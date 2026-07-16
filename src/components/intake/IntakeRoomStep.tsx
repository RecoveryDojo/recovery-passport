import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  onCompleted: () => void;
}

export function IntakeRoomStep({ sessionId, onCompleted }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["intake-room", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("intake_sessions")
        .select("room_note")
        .eq("id", sessionId)
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (data) setNote(data.room_note ?? "");
  }, [data]);

  const handleContinue = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("intake_sessions")
      .update({ room_note: note.trim() || null })
      .eq("id", sessionId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onCompleted();
  };

  if (isLoading) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-primary">Room</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Note the room and bed shown to the participant.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="room">Room / bed shown to participant</Label>
        <Textarea
          id="room"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Room 2, bed by the window"
        />
      </div>
      <Button onClick={handleContinue} disabled={saving} className="w-full min-h-[52px]">
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
