import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ProgressDashboard from "@/components/progress/ProgressDashboard";

/**
 * Participant-facing progress page. Peer & admin views embed
 * <ProgressDashboard /> directly inside their existing detail surfaces.
 */
const ProgressPage = () => {
  const { user } = useAuth();

  const { data: profileId } = useQuery({
    queryKey: ["my-profile-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_participant_profile_id");
      return (data as string) ?? null;
    },
  });

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <Link
        to="/card"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Card
      </Link>

      <div>
        <h1 className="text-xl font-bold text-foreground">My Progress</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A running view of your Recovery Capital, check-ins, assessments, milestones, and plan.
        </p>
      </div>

      {!profileId ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ProgressDashboard participantId={profileId} role="participant" />
      )}
    </div>
  );
};

export default ProgressPage;
