import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PaymentLedger from "@/components/PaymentLedger";

const ParticipantPaymentsPage = () => {
  const { user } = useAuth();

  const { data: profileId, isLoading } = useQuery({
    queryKey: ["my-profile-id-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      return data?.id ?? null;
    },
  });

  if (isLoading || !profileId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">My Payments</h1>
      <p className="text-xs text-muted-foreground">Program fee is due weekly.</p>
      <PaymentLedger participantId={profileId} />
    </div>
  );
};

export default ParticipantPaymentsPage;
