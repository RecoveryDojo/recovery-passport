/**
 * Participant card widget: shows any pending assessment_assignments
 * (PHQ-9, GAD-7, custom instruments). Tapping opens the generic take page
 * with the assignment_id in the query string so the session gets linked
 * back to the assignment on submit.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ClipboardCheck, ChevronRight } from "lucide-react";

const PendingAssessmentsCard = () => {
  const { data: assignments } = useQuery({
    queryKey: ["pending-assignments", "me"],
    queryFn: async () => {
      const { data: profileId } = await supabase.rpc("get_participant_profile_id");
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("assessment_assignments")
        .select("id, cadence_tag, due_date, instrument:instrument_id(id, title)")
        .eq("participant_id", profileId as string)
        .eq("status", "pending")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as any[];
    },
  });

  if (!assignments || assignments.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-accent" />
        <p className="font-semibold text-sm text-foreground">Assessments to complete</p>
      </div>
      <div className="space-y-2">
        {assignments.map((a) => (
          <Link
            key={a.id}
            to={`/assessment/take/${a.instrument?.id}?assignment=${a.id}`}
            className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-accent/50 transition-colors"
          >
            <div>
              <p className="font-medium text-sm text-foreground">{a.instrument?.title}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {String(a.cadence_tag).replace("_", "-")}
                {a.due_date && ` · due ${format(new Date(a.due_date), "MMM d")}`}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PendingAssessmentsCard;
