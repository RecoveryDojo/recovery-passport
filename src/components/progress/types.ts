/**
 * Progress Dashboard — card contract.
 *
 * Every metric shown on the participant progress dashboard is a self-contained
 * card that plugs into the registry. To add a new metric (e.g. daily actions,
 * self-care mood, journaling streak, peer visits):
 *
 *   1. Create `src/components/progress/cards/MyCard.tsx` exporting a component
 *      that takes `{ participantId, role }`.
 *   2. Add one entry to `registry.ts`.
 *
 * That is the entire contract. Never hardcode a card inside ProgressDashboard.
 */
import type { FC } from "react";

export type ProgressRole = "participant" | "peer" | "admin";

export interface ProgressCardProps {
  participantId: string;
  role: ProgressRole;
}

export interface ProgressCard {
  /** Stable identifier, used as React key and for future admin ordering UIs. */
  id: string;
  /** Human title (shown by the card itself, not the wrapper). */
  title: string;
  /** Which roles can see this card. */
  roles: ProgressRole[];
  /** Lower = earlier. Leave gaps (10, 20, 30…) so new cards slot between. */
  order: number;
  /** The card body. */
  Component: FC<ProgressCardProps>;
}
