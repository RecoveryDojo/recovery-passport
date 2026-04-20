/**
 * Typed event emitter for cross-role signals.
 *
 * Every cross-role action in the app MUST emit through `emitEvent()` instead
 * of writing to `audit_log` or `notifications` directly. This guarantees:
 *
 *   1. The event name is in the typed `AppEvent` union (compile-time check).
 *   2. The audit row is consistent (same `action`, `target_type`, `target_id`
 *      shape every time).
 *   3. Notifications fan-out follows the rules in docs/interdependency-map.md.
 *
 * `emitEvent` performs writes only — it does NOT navigate, toast, or refresh
 * caches. Callers handle their own UX.
 *
 * See: docs/interdependency-map.md
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

// ─── Event taxonomy ──────────────────────────────────────────────────────────

export type AppEvent =
  // Participant-originated
  | "assessment.completed"
  | "assessment.confirmed"
  | "peer_request.created"
  | "peer_request.cancelled"
  | "plan_step.completed"
  | "phase.advanced"
  | "consent.created"
  | "shared_link.created"
  | "agreement.acknowledged"
  // Peer-originated
  | "checkin.logged"
  | "checkin.low_mood"
  | "note.created"
  | "note.crisis"
  | "milestone.unlocked"
  | "level_up"
  | "peer_request.responded"
  | "referral.created"
  | "self_care.flagged"
  // Admin-originated
  | "peer.approved"
  | "peer.rejected"
  | "peer.suspended"
  | "peer.edits_approved"
  | "participant.assigned_peer"
  | "supervisor_feedback.created"
  | "payment.recorded"
  | "agreement.published"
  | "crps.eligible";

// ─── Notification recipient shape ────────────────────────────────────────────

export interface EventNotification {
  /** Recipient user_id. Use array form on `recipients` for fan-out. */
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

export interface EmitEventPayload {
  /** Audit log target_type (e.g. 'weekly_checkin', 'participant_profile'). */
  target_type?: string;
  /** Audit log target_id (typically the row that was created/changed). */
  target_id?: string;
  /** Free-form audit metadata (participant ids, scores, etc.). */
  metadata?: Record<string, unknown>;
  /** Zero or more notifications to fan out. */
  recipients?: EventNotification[];
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Emit a contract event. Writes one `audit_log` row + N `notifications` rows.
 *
 * Errors are logged to console but never thrown — emitting an event must not
 * break the user-facing action that triggered it.
 */
export async function emitEvent(
  event: AppEvent,
  payload: EmitEventPayload = {}
): Promise<void> {
  const { target_type, target_id, metadata, recipients } = payload;

  // 1. Audit log (best-effort; ignored if user is anon)
  const auditPromise = supabase
    .from("audit_log")
    .insert({
      action: event,
      target_type: target_type ?? null,
      target_id: target_id ?? null,
      metadata: (metadata ?? null) as never,
    })
    .then(({ error }) => {
      if (error) {
        // Anon callers (e.g. log_passport_view) can't insert here — that's fine.
        // For authenticated callers, log so we notice silent drift.
        console.warn(`[emitEvent ${event}] audit_log insert failed:`, error.message);
      }
    });

  // 2. Notifications fan-out
  const notifPromise =
    recipients && recipients.length > 0
      ? supabase
          .from("notifications")
          .insert(
            recipients.map((r) => ({
              user_id: r.user_id,
              type: r.type,
              title: r.title,
              body: r.body ?? null,
              link: r.link ?? null,
              related_id: target_id ?? null,
              related_type: target_type ?? null,
            }))
          )
          .then(({ error }) => {
            if (error) {
              console.warn(
                `[emitEvent ${event}] notifications insert failed:`,
                error.message
              );
            }
          })
      : Promise.resolve();

  await Promise.all([auditPromise, notifPromise]);
}
