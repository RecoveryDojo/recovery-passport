import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CheckInsTab from "@/components/CheckInsTab";

const AdminParticipantCheckInsPage = () => {
  const { participantId } = useParams<{ participantId: string }>();

  if (!participantId) return null;

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <Link
        to="/admin/participants"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-xl font-bold text-foreground">Check-In History</h1>
      <CheckInsTab participantId={participantId} viewerRole="admin" />
    </div>
  );
};

export default AdminParticipantCheckInsPage;
