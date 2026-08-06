import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import IntakePacket from "@/components/intake/packet/IntakePacket";

export default function IntakePacketPage({ backTo }: { backTo?: string }) {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-4 print:max-w-none print:px-0">
      <Button asChild variant="ghost" size="sm" className="print:hidden -ml-2">
        <Link to={backTo ?? "/admin/intake-sessions"}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Link>
      </Button>
      {sessionId && <IntakePacket sessionId={sessionId} />}
    </div>
  );
}
