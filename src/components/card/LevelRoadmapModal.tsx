/**
 * Level Roadmap Modal — what each card level means and how to reach it.
 *
 * Triggered by tapping the level badge on the participant card. Shows the
 * 4 tiers with their milestone thresholds and highlights the participant's
 * current level. Pulls earned-count from `useParticipantClinicalSummary`.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Star, Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";
import type { Database } from "@/integrations/supabase/types";

type CardLevel = Database["public"]["Enums"]["card_level"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  currentLevel: CardLevel;
}

const TIERS: Array<{
  key: CardLevel;
  label: string;
  threshold: number;
  description: string;
  icon: typeof Star;
  badgeClass: string;
}> = [
  {
    key: "rookie",
    label: "Rookie",
    threshold: 0,
    description: "Just stepping up to the plate. Everyone starts here.",
    icon: Medal,
    badgeClass: "bg-[hsl(0,0%,63%)] text-white",
  },
  {
    key: "starter",
    label: "Starter",
    threshold: 4,
    description: "On the roster — 4 milestones earned.",
    icon: Award,
    badgeClass: "bg-[hsl(217,91%,60%)] text-white",
  },
  {
    key: "veteran",
    label: "Veteran",
    threshold: 7,
    description: "Holding it down with 7 milestones earned.",
    icon: Trophy,
    badgeClass: "bg-primary text-primary-foreground",
  },
  {
    key: "all_star",
    label: "All-Star",
    threshold: 10,
    description: "Top tier — 10 or more milestones earned.",
    icon: Star,
    badgeClass: "bg-accent text-accent-foreground",
  },
];

const LevelRoadmapModal = ({ open, onOpenChange, participantId, currentLevel }: Props) => {
  const { data } = useParticipantClinicalSummary(participantId);
  const earned = data?.earnedMilestones.length ?? 0;
  const total = data?.totalMilestoneCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Your Roadmap</DialogTitle>
          <DialogDescription>
            You've earned {earned} of {total} milestones. Here's how levels work.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 mt-2">
          {TIERS.map((tier) => {
            const isCurrent = tier.key === currentLevel;
            const isReached = earned >= tier.threshold;
            const Icon = tier.icon;
            return (
              <li
                key={tier.key}
                className={cn(
                  "rounded-xl border p-3 flex items-start gap-3 transition-colors",
                  isCurrent
                    ? "border-accent bg-accent/5"
                    : isReached
                      ? "border-border bg-card"
                      : "border-border bg-muted/30 opacity-70"
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    tier.badgeClass
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{tier.label}</p>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase text-accent tracking-wider">
                        You're here
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tier.description}
                  </p>
                  {!isReached && (
                    <p className="text-xs text-foreground mt-1 font-medium">
                      {tier.threshold - earned} more milestone
                      {tier.threshold - earned === 1 ? "" : "s"} to unlock.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

export default LevelRoadmapModal;
