import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import PaymentLedger from "@/components/PaymentLedger";
import { emitEvent } from "@/lib/events";
import type { Database } from "@/integrations/supabase/types";

type PaymentType = Database["public"]["Enums"]["payment_type"];

const AdminPaymentsPage = () => {
  const { participantId } = useParams<{ participantId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<PaymentType>("charge");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["participant-name", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("first_name, last_name")
        .eq("id", participantId!)
        .single();
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("payment_records")
        .insert({
          participant_id: participantId!,
          type,
          amount: parseFloat(amount),
          description: description.trim(),
          recorded_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      await emitEvent("payment.recorded", {
        target_type: "payment_records",
        target_id: inserted?.id,
        metadata: {
          participant_id: participantId,
          type,
          amount: parseFloat(amount),
        },
      });
    },
    onSuccess: () => {
      toast.success("Entry logged");
      setShowForm(false);
      setAmount("");
      setDescription("");
      setType("charge");
      queryClient.invalidateQueries({ queryKey: ["payment-records", participantId] });
    },
    onError: () => toast.error("Failed to log entry"),
  });

  if (!participantId) return null;

  const fullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Participant"
    : "Participant";

  return (
    <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto space-y-4">
      <Link
        to="/admin/participants"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">{fullName}</p>
        </div>
        {!showForm && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-1" /> Log Entry
          </Button>
        )}
      </div>

      {/* Add entry form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <Select value={type} onValueChange={(v) => setType(v as PaymentType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="charge">Charge</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Textarea
            placeholder="Description (required)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <div className="flex gap-2">
            <Button
              onClick={() => addMutation.mutate()}
              disabled={
                !amount ||
                parseFloat(amount) <= 0 ||
                !description.trim() ||
                addMutation.isPending
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {addMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <PaymentLedger participantId={participantId} showLoggedBy />
    </div>
  );
};

export default AdminPaymentsPage;
