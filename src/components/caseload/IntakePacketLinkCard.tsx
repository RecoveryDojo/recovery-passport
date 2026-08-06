import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, ChevronRight } from "lucide-react";

export default function IntakePacketLinkCard({
  participantProfileId,
}: {
  participantProfileId: string;
}) {
  const { data } = useQuery({
    queryKey: ["participant-intake-session", participantProfileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("intake_sessions")
        .select("id, status, completed_at")
        .eq("participant_id", participantProfileId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!data) return null;

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Intake packet</p>
            <p className="text-xs text-muted-foreground">
              {data.status === "completed"
                ? "Full signed packet — forms, goals, screening, belongings"
                : "Intake in progress — partial packet"}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={`/intake-packet/${data.id}`}>
            Review
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
