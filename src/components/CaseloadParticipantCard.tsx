import { useState } from "react";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import LogCheckInSheet from "./LogCheckInSheet";
import QuickActionsMenu from "./caseload/QuickActionsMenu";
import type { Database } from "@/integrations/supabase/types";

type CardLevel = Database["public"]["Enums"]["card_level"];

const LEVEL_LABELS: Record<CardLevel, string> = {
  rookie: "ROOKIE",
  starter: "STARTER",
  veteran: "VETERAN",
  all_star: "ALL-STAR",
};

const LEVEL_STYLES: Record<CardLevel, string> = {
  rookie: "bg-[hsl(0,0%,63%)] text-white",
  starter: "bg-[hsl(217,91%,60%)] text-white",
  veteran: "bg-primary text-primary-foreground",
  all_star: "bg-accent text-accent-foreground",
};

interface Participant {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  card_level: CardLevel;
  recovery_start_date: string | null;
  pathway: string | null;
  programs: { name: string } | null;
}

interface Props {
  participant: Participant;
  earnedMilestones: number;
  totalMilestones: number;
  lastCheckin: string | undefined;
  peerSpecialistId: string;
}

const CaseloadParticipantCard = ({
  participant,
  earnedMilestones,
  totalMilestones,
  lastCheckin,
  peerSpecialistId,
}: Props) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const name =
    [participant.first_name, participant.last_name].filter(Boolean).join(" ") || "Unknown";
  const initials =
    (participant.first_name?.[0] ?? "") + (participant.last_name?.[0] ?? "");
  const programName = participant.programs?.name ?? "No program";
  const daysInRecovery = participant.recovery_start_date
    ? differenceInDays(new Date(), new Date(participant.recovery_start_date))
    : 0;
  const level = participant.card_level ?? "rookie";
  const daysSinceCheckin = lastCheckin
    ? differenceInDays(new Date(), new Date(lastCheckin))
    : null;

  let statusColor = "bg-muted";
  let statusIcon = <AlertCircle className="h-3 w-3" />;
  if (daysSinceCheckin != null) {
    if (daysSinceCheckin <= 7) {
      statusColor = "bg-green-500";
      statusIcon = <Check className="h-3 w-3 text-white" />;
    } else if (daysSinceCheckin <= 14) {
      statusColor = "bg-amber-500";
      statusIcon = <Clock className="h-3 w-3 text-white" />;
    } else {
      statusColor = "bg-red-500";
      statusIcon = <AlertCircle className="h-3 w-3 text-white" />;
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden relative hover:border-primary/40 hover:shadow-sm transition-all">
        {/* Top-right Actions button (does not navigate) */}
        <div className="absolute top-3 right-3 z-10">
          <QuickActionsMenu
            participantId={participant.id}
            onLogCheckIn={() => setSheetOpen(true)}
          />
        </div>

        {/* Whole card is a link to the detail page */}
        <Link
          to={`/caseload/${participant.id}`}
          className="block p-4 pr-24"
          aria-label={`Open ${name}'s chart`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12">
                {participant.photo_url ? (
                  <AvatarImage src={participant.photo_url} alt={name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center",
                  statusColor,
                )}
              >
                {statusIcon}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{name}</p>
                <Badge className={cn("text-[10px] px-1.5 py-0", LEVEL_STYLES[level])}>
                  {LEVEL_LABELS[level]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{programName}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{daysInRecovery} days</span>
            <span>{earnedMilestones} / {totalMilestones} milestones</span>
            <span>
              {lastCheckin
                ? `Last check-in ${daysSinceCheckin}d ago`
                : "No check-ins yet"}
            </span>
          </div>

          {(daysSinceCheckin === null || daysSinceCheckin > 7) && (
            <div className="mt-2 bg-red-100 text-red-700 text-xs font-medium rounded-md px-3 py-1.5">
              {daysSinceCheckin === null
                ? "Check-in overdue — no check-ins recorded"
                : `Check-in overdue — ${daysSinceCheckin} days since last check-in`}
            </div>
          )}

          <div className="mt-3 flex items-center justify-end text-xs text-primary font-medium">
            Open chart
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </div>
        </Link>
      </div>

      <LogCheckInSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        participantId={participant.id}
        participantName={name}
        peerSpecialistId={peerSpecialistId}
      />
    </>
  );
};

export default CaseloadParticipantCard;
