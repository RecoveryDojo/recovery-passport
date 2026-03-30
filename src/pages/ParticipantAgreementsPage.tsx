import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ParticipantAgreementsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get participant profile with program
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["my-profile-agreements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles")
        .select("id, current_program_id, programs:current_program_id(name)")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Get current agreement for participant's program
  const { data: currentAgreement, isLoading: loadingAgreement } = useQuery({
    queryKey: ["current-agreement", profile?.current_program_id],
    enabled: !!profile?.current_program_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_agreements")
        .select("*")
        .eq("program_id", profile!.current_program_id!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Get participant's latest acknowledgment for this program
  const { data: acknowledgment } = useQuery({
    queryKey: ["my-acknowledgment", currentAgreement?.id],
    enabled: !!currentAgreement && !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_acknowledgments")
        .select("*")
        .eq("participant_id", profile!.id)
        .eq("agreement_id", currentAgreement!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("agreement_acknowledgments")
        .insert({
          participant_id: profile!.id,
          agreement_id: currentAgreement!.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agreement acknowledged");
      queryClient.invalidateQueries({ queryKey: ["my-acknowledgment"] });
    },
    onError: () => toast.error("Failed to acknowledge agreement"),
  });

  if (loadingProfile || loadingAgreement) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!profile?.current_program_id) {
    return (
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-4">Program Guidelines</h1>
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">
            You are not currently enrolled in a program.
          </p>
        </div>
      </div>
    );
  }

  const programName = (profile.programs as any)?.name ?? "Your Program";
  const hasAcknowledged = !!acknowledgment;

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">Program Guidelines</h1>
      <p className="text-sm text-muted-foreground">{programName}</p>

      {!currentAgreement ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No program guidelines have been posted yet.
          </p>
        </div>
      ) : (
        <>
          {/* Updated banner when not yet acknowledged */}
          {!hasAcknowledged && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {currentAgreement.version > 1
                  ? "The program guidelines have been updated. Please review and re-acknowledge."
                  : "Please review and acknowledge the program guidelines below."}
              </p>
            </div>
          )}

          {/* Agreement content */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-3">
              Version {currentAgreement.version} · Published{" "}
              {format(new Date(currentAgreement.created_at), "MMM d, yyyy")}
            </p>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
              {currentAgreement.content}
            </div>
          </div>

          {/* Acknowledgment */}
          {hasAcknowledged ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
              <Check className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                You acknowledged this version on{" "}
                {format(new Date(acknowledgment.acknowledged_at), "MMM d, yyyy")}.
              </p>
            </div>
          ) : (
            <Button
              onClick={() => acknowledgeMutation.mutate()}
              disabled={acknowledgeMutation.isPending}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-5"
            >
              {acknowledgeMutation.isPending
                ? "Acknowledging…"
                : "I have read and understand these guidelines"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default ParticipantAgreementsPage;
