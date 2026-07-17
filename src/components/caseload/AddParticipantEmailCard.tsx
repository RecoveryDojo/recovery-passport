import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  participantProfileId: string;
  userId: string | null;
}

export default function AddParticipantEmailCard({ participantProfileId, userId }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: email } = useQuery({
    queryKey: ["participant-user-email", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data.email as string | null;
    },
  });

  if (!email || !email.endsWith("@recoverypassport.placeholder")) return null;

  const save = async () => {
    const trimmed = value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-participant-email", {
        body: { participant_profile_id: participantProfileId, new_email: trimmed },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Email updated");
      setValue("");
      qc.invalidateQueries({ queryKey: ["participant-user-email", userId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-accent/40 bg-accent/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Mail className="h-4 w-4 text-accent mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">No real email on file</p>
            <p className="text-xs text-muted-foreground">
              Add a real email so this participant can claim their account and receive password resets.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            inputMode="email"
            placeholder="participant@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
          />
          <Button onClick={save} disabled={saving || !value.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
