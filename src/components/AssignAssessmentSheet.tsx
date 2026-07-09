/**
 * Peer-only sheet: assign a published instrument (PHQ-9, GAD-7, or custom)
 * to a participant with a cadence tag and optional due date.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardPlus } from "lucide-react";

interface Props {
  participantId: string;
  participantName: string;
  trigger?: React.ReactNode;
}

const AssignAssessmentSheet = ({ participantId, participantName, trigger }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [instrumentId, setInstrumentId] = useState<string>("");
  const [cadence, setCadence] = useState<string>("ad_hoc");
  const [dueDate, setDueDate] = useState<string>("");

  const { data: instruments } = useQuery({
    queryKey: ["published-instruments"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_instruments")
        .select("id, title")
        .eq("status", "published")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assessment_assignments").insert({
        instrument_id: instrumentId,
        participant_id: participantId,
        assigned_by: user!.id,
        cadence_tag: cadence as any,
        due_date: dueDate || null,
        status: "pending" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Assessment assigned to ${participantName}`);
      qc.invalidateQueries({ queryKey: ["pending-assignments"] });
      setOpen(false);
      setInstrumentId("");
      setDueDate("");
      setCadence("ad_hoc");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <ClipboardPlus className="h-4 w-4 mr-1" /> Assign assessment
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>Assign an assessment</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Instrument</Label>
            <Select value={instrumentId} onValueChange={setInstrumentId}>
              <SelectTrigger><SelectValue placeholder="Choose an instrument" /></SelectTrigger>
              <SelectContent>
                {(instruments ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cadence</Label>
            <Select value={cadence} onValueChange={setCadence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intake">Intake</SelectItem>
                <SelectItem value="thirty_day">30-day</SelectItem>
                <SelectItem value="sixty_day">60-day</SelectItem>
                <SelectItem value="ninety_day">90-day</SelectItem>
                <SelectItem value="discharge">Discharge</SelectItem>
                <SelectItem value="ad_hoc">Ad hoc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => assign.mutate()}
            disabled={!instrumentId || assign.isPending}
          >
            {assign.isPending ? "Assigning…" : "Assign"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AssignAssessmentSheet;
