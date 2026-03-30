import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type PaymentType = Database["public"]["Enums"]["payment_type"];

const TYPE_STYLES: Record<PaymentType, { label: string; badge: string; amountClass: string }> = {
  charge: { label: "Charge", badge: "bg-red-100 text-red-700 border-red-200", amountClass: "text-red-600" },
  payment: { label: "Payment", badge: "bg-green-100 text-green-700 border-green-200", amountClass: "text-green-600" },
  adjustment: { label: "Adjustment", badge: "bg-muted text-muted-foreground border-border", amountClass: "text-muted-foreground" },
};

interface PaymentLedgerProps {
  participantId: string;
  showLoggedBy?: boolean;
}

const PaymentLedger = ({ participantId, showLoggedBy = false }: PaymentLedgerProps) => {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["payment-records", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_records")
        .select("*")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Admin names for "logged by"
  const adminIds = [...new Set(records.map((r) => r.recorded_by))];
  const { data: adminNames = {} } = useQuery({
    queryKey: ["admin-names", adminIds],
    enabled: adminIds.length > 0 && showLoggedBy,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, email")
        .in("id", adminIds);
      const map: Record<string, string> = {};
      data?.forEach((u) => { map[u.id] = u.email.split("@")[0]; });
      return map;
    },
  });

  // Calculate balance: charges are positive, payments/adjustments reduce balance
  const balance = records.reduce((sum, r) => {
    const amt = Number(r.amount);
    if (r.type === "charge") return sum + amt;
    if (r.type === "payment") return sum - amt;
    // adjustment: amount can be positive (credit) or negative (debit) — stored as absolute
    // For adjustments we treat them as reductions (credits)
    return sum - amt;
  }, 0);

  if (isLoading) {
    return <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <BalanceDisplay balance={balance} />

      {/* Ledger */}
      {records.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">No payment records yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const style = TYPE_STYLES[record.type];
            const amt = Number(record.amount);
            const prefix = record.type === "charge" ? "+" : "−";
            return (
              <div key={record.id} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${style.badge}`}>
                        {style.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(record.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate">{record.description ?? "—"}</p>
                    {showLoggedBy && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Logged by {adminNames[record.recorded_by] ?? "admin"}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${style.amountClass}`}>
                    {prefix}${amt.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const BalanceDisplay = ({ balance }: { balance: number }) => {
  const isCredit = balance < 0;
  const isPaidUp = balance === 0;

  return (
    <div className={`rounded-xl p-4 text-center border ${
      isPaidUp
        ? "bg-green-50 border-green-200"
        : isCredit
          ? "bg-green-50 border-green-200"
          : "bg-amber-50 border-amber-200"
    }`}>
      {isPaidUp ? (
        <p className="text-lg font-bold text-green-700">$0 — Paid up ✓</p>
      ) : isCredit ? (
        <p className="text-lg font-bold text-green-700">Credit: ${Math.abs(balance).toFixed(2)}</p>
      ) : (
        <p className="text-lg font-bold text-amber-700">${balance.toFixed(2)} due</p>
      )}
    </div>
  );
};

export default PaymentLedger;
