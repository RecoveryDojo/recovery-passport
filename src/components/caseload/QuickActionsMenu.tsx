/**
 * Caseload Quick Actions Menu — labeled "Actions" button attached to each card.
 *
 * Routes the peer to the most common actions for one participant. Each menu
 * item deep-links to the appropriate tab on the detail page so peers don't
 * have to hunt for it.
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ClipboardCheck,
  FileText,
  Award,
  Eye,
  Users,
} from "lucide-react";

interface Props {
  participantId: string;
  onLogCheckIn: () => void;
}

const stop = (e: React.MouseEvent | React.PointerEvent) => {
  e.stopPropagation();
  e.preventDefault();
};

const QuickActionsMenu = ({ participantId, onLogCheckIn }: Props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1 shadow-sm"
          onClick={stop}
          aria-label="Quick actions"
        >
          Actions
          <ChevronDown className="h-3.5 w-3.5" />
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
          <Link to={`/caseload/${participantId}?tab=journey`}>
            <Eye className="h-4 w-4 mr-2" />
            View journey
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/caseload/${participantId}?tab=notes`}>
            <FileText className="h-4 w-4 mr-2" />
            Add note
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/caseload/${participantId}?tab=journey#milestones`}>
            <Award className="h-4 w-4 mr-2" />
            Unlock milestone
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/caseload/${participantId}?tab=care-team`}>
            <Users className="h-4 w-4 mr-2" />
            View care team
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickActionsMenu;
