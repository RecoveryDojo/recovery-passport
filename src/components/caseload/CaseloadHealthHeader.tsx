/**
 * Caseload Health Header — at-a-glance dashboard for the peer specialist.
 *
 * Aggregates the caseload list passed from the parent (no extra query).
 * Shows: total participants, # crisis (low mood ≤2 in last 14 days), # overdue
 * (no check-in in 14d), # all-stars. Drives the sort/filter dropdowns
 * surfaced as siblings on CaseloadPage.
 */
import { Card, CardContent } from "@/components/ui/card";
import { differenceInDays } from "date-fns";
import { AlertTriangle, Clock, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaseloadParticipant {
  id: string;
  card_level: string | null;
}

interface Props {
  participants: CaseloadParticipant[];
  lastCheckins: Record<string, string>;
  lastMoods: Record<string, number>;
}

const StatTile = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  tone: "danger" | "warn" | "neutral" | "accent";
}) => {
  const toneClass = {
    danger: "text-red-600",
    warn: "text-amber-600",
    neutral: "text-primary",
    accent: "text-accent",
  }[tone];
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className={cn("h-4 w-4 shrink-0", toneClass)} aria-hidden />
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </p>
      </div>
    </div>
  );
};

const CaseloadHealthHeader = ({ participants, lastCheckins, lastMoods }: Props) => {
  const total = participants.length;

  let crisis = 0;
  let overdue = 0;
  let allStar = 0;

  participants.forEach((p) => {
    const last = lastCheckins[p.id];
    const days = last ? differenceInDays(new Date(), new Date(last)) : null;
    if (days === null || days > 14) overdue++;
    const mood = lastMoods[p.id];
    if (mood !== undefined && mood <= 2) crisis++;
    if (p.card_level === "all_star") allStar++;
  });

  return (
    <Card className="bg-card">
      <CardContent className="p-4 grid grid-cols-4 gap-3">
        <StatTile label="Caseload" value={total} icon={Users} tone="neutral" />
        <StatTile label="Crisis" value={crisis} icon={AlertTriangle} tone="danger" />
        <StatTile label="Overdue" value={overdue} icon={Clock} tone="warn" />
        <StatTile label="All-Star" value={allStar} icon={Star} tone="accent" />
      </CardContent>
    </Card>
  );
};

export default CaseloadHealthHeader;
