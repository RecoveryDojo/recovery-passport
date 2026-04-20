import { Link } from "react-router-dom";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";

interface RcSparklineProps {
  participantId: string;
}

/**
 * Inline sparkline of the last 6 RC overall_score values.
 * Shows latest value + tiny trend chart. Tap → /assessment/take.
 */
const RcSparkline = ({ participantId }: RcSparklineProps) => {
  const { data: summary } = useParticipantClinicalSummary(participantId);

  const points = (summary?.recentAssessments ?? [])
    .slice()
    .reverse()
    .map((a) => a.overall_score)
    .filter((v): v is number => v != null);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const trend = latest != null && previous != null
    ? latest > previous ? "↑" : latest < previous ? "↓" : "→"
    : null;

  // Build SVG path
  const W = 60;
  const H = 24;
  let path = "";
  if (points.length > 1) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    path = points
      .map((v, i) => {
        const x = (i / (points.length - 1)) * W;
        const y = H - ((v - min) / range) * H;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <Link
      to="/assessment/take"
      className="bg-primary-foreground/10 rounded-xl py-3 text-center block hover:bg-primary-foreground/15 transition-colors"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-2xl font-bold text-primary-foreground">
          {latest ?? "—"}
        </span>
        {trend && (
          <span className={`text-sm font-bold ${trend === "↑" ? "text-green-300" : trend === "↓" ? "text-red-300" : "text-primary-foreground/70"}`}>
            {trend}
          </span>
        )}
      </div>
      {points.length > 1 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-1" width="60" height="14">
          <path d={path} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" />
        </svg>
      )}
      <p className="text-xs text-primary-foreground/70 mt-0.5">RC Score</p>
    </Link>
  );
};

export default RcSparkline;
