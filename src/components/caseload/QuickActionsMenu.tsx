/**
 * Caseload Quick Actions Menu — `…` dropdown attached to each card.
 *
 * Routes the peer to the most common actions for one participant without
 * needing to open the full detail page first.
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ClipboardCheck, FileText, Award, Eye } from "lucide-react";

interface Props {
  participantId: string;
  onLogCheckIn: () => void;
}

const QuickActionsMenu = ({ participantId, onLogCheckIn }: Props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
          aria-label="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onSelect={onLogCheckIn}>
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Log check-in
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/caseload/${participantId}`}>
            <Eye className="h-4 w-4 mr-2" />
            View full detail
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/caseload/${participantId}#notes`}>
            <FileText className="h-4 w-4 mr-2" />
            Add note
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/caseload/${participantId}#milestones`}>
            <Award className="h-4 w-4 mr-2" />
            Unlock milestone
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickActionsMenu;
