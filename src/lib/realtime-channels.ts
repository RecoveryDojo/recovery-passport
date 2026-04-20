/**
 * Realtime channel & React Query invalidation key registry.
 *
 * Every realtime subscription in the app MUST use these helpers instead of
 * stringly-typed channel names. Same for the cache keys invalidated in
 * response to each event. This guarantees publishers and subscribers stay
 * in sync as the app grows.
 *
 * See: docs/interdependency-map.md (column "Realtime channel")
 *      docs/role-surface-matrix.md (column "Realtime channels subscribed")
 */

// ─── Channel name builders ───────────────────────────────────────────────────

export const channels = {
  /** Participant card-level changes (level-up celebration). */
  cardLevel: (participantId: string) => `card-level-${participantId}`,

  /** Participant milestone unlocks. */
  milestones: (participantId: string) => `milestones-${participantId}`,

  /** Assessment session inserts/confirmations. */
  assessments: (participantId: string) => `assessments-${participantId}`,

  /** Weekly check-ins for a participant. */
  checkins: (participantId: string) => `checkins-${participantId}`,

  /** Progress notes for a participant (general/crisis/milestone/...). */
  notes: (participantId: string) => `notes-${participantId}`,

  /** Plan phases / steps for a participant's recovery plan. */
  plan: (participantId: string) => `plan-${participantId}`,

  /** Peer's caseload (new participant assignments). */
  caseload: (peerUserId: string) => `caseload-${peerUserId}`,

  /** Peer requests addressed to a peer specialist. */
  peerRequests: (peerUserId: string) => `peer-requests-${peerUserId}`,

  /** Peer approval/suspension/edit-approval status changes. */
  peerStatus: (peerUserId: string) => `peer-status-${peerUserId}`,

  /** Supervisor feedback addressed to a peer's work. */
  feedback: (peerUserId: string) => `feedback-${peerUserId}`,
} as const;

// ─── React Query invalidation key builders ───────────────────────────────────
//
// When a realtime payload arrives, invalidate exactly these keys. Keep the
// shapes here so consumers don't drift.

export const qk = {
  participantCard: (userId: string) => ["participant-card", userId] as const,
  milestoneStats: (participantId: string) => ["milestone-stats", participantId] as const,
  recentMilestones: (participantId: string) => ["recent-milestones", participantId] as const,
  rcScores: (participantId: string) => ["rc-scores", participantId] as const,
  caseload: () => ["caseload"] as const,
  caseloadCheckins: () => ["caseload-checkins"] as const,
  weeklyCheckins: (participantId: string) => ["weekly-checkins", participantId] as const,
  moodTrend: (participantId: string) => ["mood-trend", participantId] as const,
  participantNotes: (participantId: string) => ["participant-notes", participantId] as const,
  participantPlan: (participantId: string) => ["participant-plan", participantId] as const,
  unreadNotifications: (userId: string) => ["unread-notifications", userId] as const,
  notificationsPage: (userId: string) => ["notifications-page", userId] as const,
  peerRequests: (peerUserId: string) => ["peer-requests", peerUserId] as const,
  supervisorFeedback: (peerUserId: string) => ["supervisor-feedback", peerUserId] as const,
} as const;
