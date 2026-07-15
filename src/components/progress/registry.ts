/**
 * Progress Dashboard — card registry.
 *
 * The dashboard renders whatever is in this array (filtered by role, sorted
 * by `order`). To add a new metric card, drop it here — no changes to
 * ProgressDashboard.tsx, no changes to the pages that mount it.
 *
 * Guidelines for new cards:
 *   • Own your own data hook. Don't reach into another card's state.
 *   • Handle sparse data as the default case (most participants have 1–3
 *     data points because stays are ~10 days). Every card must have a
 *     designed early-days state — never an empty chart.
 *   • Put the window/lookback in a single top-of-file constant so it can
 *     be tuned without hunting through code.
 */
import type { ProgressCard } from "./types";
import RecoveryCapitalCard from "./cards/RecoveryCapitalCard";
import AssessmentTrendsCard from "./cards/AssessmentTrendsCard";
import CheckinAdherenceCard from "./cards/CheckinAdherenceCard";
import MilestoneTimelineCard from "./cards/MilestoneTimelineCard";
import RecoveryPlanCard from "./cards/RecoveryPlanCard";

export const progressCards: ProgressCard[] = [
  {
    id: "recovery-capital",
    title: "Recovery Capital",
    roles: ["participant", "peer", "admin"],
    order: 10,
    Component: RecoveryCapitalCard,
  },
  {
    id: "assessment-trends",
    title: "Assessment Trends",
    roles: ["participant", "peer", "admin"],
    order: 20,
    Component: AssessmentTrendsCard,
  },
  {
    id: "checkin-adherence",
    title: "Check-in Adherence",
    roles: ["participant", "peer", "admin"],
    order: 30,
    Component: CheckinAdherenceCard,
  },
  {
    id: "milestone-timeline",
    title: "Milestone Timeline",
    roles: ["participant", "peer", "admin"],
    order: 40,
    Component: MilestoneTimelineCard,
  },
  {
    id: "recovery-plan",
    title: "Recovery Plan Progress",
    roles: ["participant", "peer", "admin"],
    order: 50,
    Component: RecoveryPlanCard,
  },
];
