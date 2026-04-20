import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";
import { differenceInDays, parseISO, startOfWeek, format } from "date-fns";
import { Flame, Calendar, Award } from "lucide-react";

interface StreakStatsProps {
  participantId: string;
}

const StreakStats = ({ participantId }: StreakStatsProps) => {
  const { data: summary } = useParticipantClinicalSummary(participantId);
  if (!summary) return null;

  // 1. Longest plan-step completion streak (consecutive days)
  const completedDates = summary.planSteps
    .filter((s) => s.is_completed && s.completed_at)
    .map((s) => parseISO(s.completed_at!).toISOString().slice(0, 10))
    .sort();
  const uniqueDays = Array.from(new Set(completedDates));
  let longest = 0;
  let current = 0;
  let prev: string | null = null;
  for (const d of uniqueDays) {
    if (prev && differenceInDays(parseISO(d), parseISO(prev)) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > longest) longest = current;
    prev = d;
  }

  // 2. Consecutive check-in weeks
  const checkinWeeks = new Set(
    summary.recentCheckins.map((c) =>
      format(startOfWeek(parseISO(c.checkin_date)), "yyyy-MM-dd")
    )
  );
  let weekStreak = 0;
  const cursor = startOfWeek(new Date());
  while (true) {
    const key = format(cursor, "yyyy-MM-dd");
    if (checkinWeeks.has(key)) {
      weekStreak += 1;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  // 3. Days since last milestone
  const lastMilestone = summary.earnedMilestones[0];
  const daysSinceMilestone = lastMilestone
    ? differenceInDays(new Date(), parseISO(lastMilestone.unlocked_at))
    : null;

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      <Stat
        icon={<Flame className="h-3.5 w-3.5" />}
        value={String(longest)}
        label="Step streak"
      />
      <Stat
        icon={<Calendar className="h-3.5 w-3.5" />}
        value={String(weekStreak)}
        label="Wk check-ins"
      />
      <Stat
        icon={<Award className="h-3.5 w-3.5" />}
        value={daysSinceMilestone === null ? "—" : `${daysSinceMilestone}d`}
        label="Last unlock"
      />
    </div>
  );
};

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="bg-primary-foreground/10 rounded-lg py-2 px-1 text-center">
    <div className="flex items-center justify-center gap-1 text-primary-foreground">
      {icon}
      <span className="text-base font-bold">{value}</span>
    </div>
    <p className="text-[10px] text-primary-foreground/70 mt-0.5">{label}</p>
  </div>
);

export default StreakStats;
