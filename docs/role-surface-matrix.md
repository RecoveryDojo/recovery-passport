# Role × Surface Matrix

Inverse index of `docs/interdependency-map.md`. For every screen in the app,
this lists the signals (AppEvents) it MUST render.

When you build a new tab or refactor an existing one, every signal listed here
must have working code or a documented stub. Missing signal = build incomplete.

---

## Participant surfaces

| Surface | Required signals | Realtime channels subscribed |
|---|---|---|
| `/card` | `level_up` toast, `milestone.unlocked` realtime refresh, `peer_request.responded` (Stage 3 banner), `assessment.confirmed` (RC pill), `participant.assigned_peer` | `card-level-${id}`, `milestones-${id}`, `assessments-${id}` |
| `/plan` | `plan_step.completed` (own action, optimistic), `phase.advanced` | `plan-${id}` _(future)_ |
| `/check-ins` | `checkin.logged` (read-only history) | `checkins-${id}` _(future)_ |
| `/agreements` | `agreement.published` (new badge), `agreement.acknowledged` (own action) | _(none)_ |
| `/resources` | `referral.created` (highlight on resource that was referred) | _(none)_ |
| `/payments` | `payment.recorded` | _(none)_ |
| `/notifications` | All notification types receivable by P | `notifications-${userId}` _(future global)_ |
| `/passport-config` | `consent.created`, `shared_link.created` (own actions) | _(none)_ |

## Peer Specialist surfaces

| Surface | Required signals | Realtime channels subscribed |
|---|---|---|
| `/caseload` (list) | `peer_request.created` (Pending requests), `peer_request.cancelled`, `checkin.logged` (last contact), `note.crisis` (crisis dot, 14d), `supervisor_feedback.created` (badge), engagement status (derived from `checkin.logged`) | `caseload-${peerUserId}`, `peer-requests-${peerUserId}`, `feedback-${peerUserId}` |
| `/caseload/:id` Overview | `checkin.low_mood` flag, `note.crisis` flag (14d), engagement pill, `peer_request.created` recency | `checkins-${participantId}`, `notes-${participantId}` |
| `/caseload/:id` Journey | `assessment.completed`, `assessment.confirmed`, `plan_step.completed`, `phase.advanced`, `milestone.unlocked` | `assessments-${id}`, `plan-${id}`, `milestones-${id}` |
| `/caseload/:id` Engagement | `checkin.logged` (8-week strip), contact mode mix | `checkins-${id}` |
| `/caseload/:id` Care Team | `supervisor_feedback.created` (read-only filtered to feedback on this peer's work with this participant) | `feedback-${peerUserId}` |
| `/caseload/:id` Notes | `note.created`, `note.crisis`, `agreement.acknowledged` (compliance line), `consent.created` | `notes-${id}` |
| `/peer-profile` | `peer.edits_approved`, `peer.approved`, `peer.suspended` | `peer-status-${peerUserId}` |
| `/self-care` | `self_care.flagged` (own submission feedback) | _(none)_ |
| `/crps` | `crps.eligible` | `peer-status-${peerUserId}` |
| `/notifications` | All PS-receivable types | _(future global)_ |

## Admin surfaces

| Surface | Required signals | Realtime channels subscribed |
|---|---|---|
| `/admin` (dashboard) | `participant.assigned_peer` recount, `checkin.logged` overdue derive, `note.crisis` unreviewed, `assessment.completed` pending review, `peer.approved` queue, `self_care.flagged` widget | _(polls; selective realtime acceptable)_ |
| `/admin/participants` | `participant.assigned_peer`, `assessment.completed`, `peer_request.created` | _(polls)_ |
| `/admin/participants/:id` sheet (Overview) | `checkin.low_mood`, `note.crisis`, peer workload | `checkins-${id}`, `notes-${id}` |
| sheet (Journey) | All assessment/plan/milestone events | `assessments-${id}`, `plan-${id}`, `milestones-${id}` |
| sheet (Engagement) | `checkin.logged` 8wk strip + contact mode | `checkins-${id}` |
| sheet (Care Team) | `supervisor_feedback.created` (full log + Add) | `feedback-${peerUserId}` for this participant's peer |
| sheet (Notes) | `note.created`, `note.crisis`, `agreement.acknowledged`, `consent.created`, `shared_link.created` | `notes-${id}` |
| `/admin/peers` | `peer.approved`, `peer.rejected`, `peer.suspended`, `peer.edits_approved` | _(polls)_ |
| `/admin/peer-review` | `peer.approved`/`rejected` (own action) | _(none)_ |
| `/admin/audit` | `consent.created`, `shared_link.created`, `agreement.acknowledged`, all `audit_log` rows | _(polls)_ |
| `/admin/payments` | `payment.recorded` (own action) | _(none)_ |
| `/admin/agreements` | `agreement.published` (own action) | _(none)_ |

---

## Audit checklist when adding a tab

For every required signal in your tab's row:

1. Find it in `docs/interdependency-map.md`.
2. Confirm the writer site uses `emitEvent(...)` (or has an open ticket to migrate).
3. Confirm the realtime channel name matches a constant in `src/lib/realtime-channels.ts`.
4. Confirm the React Query keys you invalidate match the constants for that channel.

If any of those four checks fail, the tab will silently miss updates.
