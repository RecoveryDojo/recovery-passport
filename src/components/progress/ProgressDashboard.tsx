import { progressCards } from "./registry";
import type { ProgressRole } from "./types";

interface Props {
  participantId: string;
  role: ProgressRole;
}

/**
 * Renders every registered card visible to `role`, ordered by `order`.
 * Layout is intentionally dumb: single column stack. Card visuals live
 * inside each card, not here.
 */
const ProgressDashboard = ({ participantId, role }: Props) => {
  const cards = progressCards
    .filter((c) => c.roles.includes(role))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {cards.map(({ id, Component }) => (
        <Component key={id} participantId={participantId} role={role} />
      ))}
    </div>
  );
};

export default ProgressDashboard;
