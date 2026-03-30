import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import NotesTab from "@/components/NotesTab";

const AdminParticipantNotesPage = () => {
  const { participantId } = useParams<{ participantId: string }>();

  const { data: profile } = useQuery({
    queryKey: ["admin-participant-profile", participantId],
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

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Participant";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/participants">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{name}</h1>
          <p className="text-sm text-muted-foreground">Progress Notes</p>
        </div>
      </div>

      <NotesTab participantId={participantId!} participantName={name} viewerRole="admin" />
    </div>
  );
};

export default AdminParticipantNotesPage;
