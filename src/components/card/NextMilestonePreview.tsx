import { Link } from "react-router-dom";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";
import { Trophy, ChevronRight } from "lucide-react";

interface NextMilestonePreviewProps {
  participantId: string;
}

const NextMilestonePreview = ({ participantId }: NextMilestonePreviewProps) => {
  const { data: summary } = useParticipantClinicalSummary(participantId);
  if (!summary) return null;

  const next = summary.nextMilestones[0];
  const hasPeer = !!summary.profile?.assigned_peer_id;

  if (!next) {
    return (
      <Link
        to="/milestones"
        className="block bg-card rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
      >
        <p className="text-sm font-semibold text-foreground">All milestones earned 🏆</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You're an All-Star. View your full journey →
        </p>
      </Link>
    );
  }

  return (
    <Link
      to="/milestones"
      className="block bg-card rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <Trophy className="h-4 w-4 text-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Next milestone
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{next.name}</p>
            {next.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{next.description}</p>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <p className="text-xs text-accent font-medium mt-2">
        {hasPeer
          ? "💬 Ask your peer to unlock this when ready"
          : "Connect with a peer to unlock milestones"}
      </p>
    </Link>
  );
};

export default NextMilestonePreview;
