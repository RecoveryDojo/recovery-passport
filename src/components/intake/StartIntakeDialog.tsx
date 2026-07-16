import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Program {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerUserId: string;
}

export default function StartIntakeDialog({ open, onOpenChange, peerUserId }: Props) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("programs").select("id, name").then(({ data }) => {
      const list = data ?? [];
      setPrograms(list);
      if (list.length && !programId) setProgramId(list[0].id);
    });
  }, [open]);

  const reset = () => {
    setFirstName(""); setLastName(""); setDob(""); setEmail(""); setProgramId("");
  };

  const canSubmit = firstName.trim() && lastName.trim() && dob && programId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // 1. Create the participant via edge function
      const { data, error } = await supabase.functions.invoke("create-intake-participant", {
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob,
          email: email.trim() || undefined,
          intake_peer_id: peerUserId,
          program_id: programId,
        },
      });
      if (error) throw error;
      const participantProfileId = (data as { participant_profile_id: string }).participant_profile_id;

      // 2. Create the intake session row
      const { data: sess, error: sessErr } = await supabase
        .from("intake_sessions")
        .insert({
          program_id: programId,
          participant_id: participantProfileId,
          started_by: peerUserId,
          current_step: 2,
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      toast.success("Intake started");
      onOpenChange(false);
      reset();
      navigate(`/intake-session/${sess.id}`);
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to start intake");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Intake</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fn">First name *</Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ln">Last name *</Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dob">Date of birth *</Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="em">Email (optional)</Label>
            <Input
              id="em"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Leave blank if none — a placeholder will be generated"
            />
          </div>
          <div className="space-y-1">
            <Label>Program *</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Intake
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
