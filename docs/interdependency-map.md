# Interdependency Map

The single source of truth for **every cross-role signal** in Recovery Passport.
Every PR that adds an action MUST add a row here. Every PR that adds a UI surface
MUST verify each signal it claims to render exists in this table.

> **Roles**: P = Participant, PS = Peer Specialist, A = Admin
> **Notification type** values come from `Database["public"]["Enums"]["notification_type"]`.
> **Realtime channel** names come from `src/lib/realtime-channels.ts`.
> **AppEvent** names come from `src/lib/events.ts`.

---

## Participant-originated events

| AppEvent | Trigger surface | DB write | Receivers | Receiver surfaces (tabs) | Notification type | Realtime channel |
|---|---|---|---|---|---|---|
| `assessment.completed` | `/assessment/take` (P self-assess) | `assessment_sessions` insert + `assessment_scores` inserts | PS, A | Caseload card RC pill, `/caseload/:id` Journey, Admin sheet Journey, `AdminParticipantsPage` "Pending Assessment" widget | `assessment_ready_for_review` (PS) | `assessments-${participantId}` |
| `assessment.confirmed` | Peer/admin confirms scores | `assessment_sessions.confirmed_by` UPDATE | P | `/card` RC sparkline → "confirmed" pill | _(none — UI only via realtime)_ | `assessments-${participantId}` |
| `peer_request.created` | `/peer-browse` → request | `peer_requests` insert | PS, A | PS `/caseload` Pending Requests, A dashboard alert with names | `peer_request_received` (PS) | `peer-requests-${peerId}` |
| `peer_request.cancelled` | P cancels own pending request | `peer_requests.status='cancelled'` | PS | PS `/caseload` Pending Requests removes row | _(none)_ | `peer-requests-${peerId}` |
| `plan_step.completed` | `/plan` → check step | `plan_action_steps.is_completed=true` | PS, A | `/caseload/:id` Journey progress, Admin sheet Journey | _(none — passive signal)_ | `plan-${participantId}` |
| `phase.advanced` | `/plan` → unlock next phase | `plan_phases.is_active=true` | PS, A | Same as above + "Phase advanced" line in Engagement | _(none — passive signal)_ | `plan-${participantId}` |
| `consent.created` | `/passport-config` → share | `consent_records` insert (+ `shared_links` insert) | A | `AdminAuditPage` compliance log, Admin sheet Notes "Compliance" line | _(none)_ | _(none — admin polls)_ |
| `shared_link.created` | `/passport-config` → share | `shared_links` insert | A | Same as above | _(none)_ | _(none — admin polls)_ |
| `agreement.acknowledged` | `/agreements` → acknowledge | `agreement_acknowledgments` insert | A | Admin sheet Notes "Compliance checklist" | _(none)_ | _(none — admin polls)_ |

## Peer Specialist-originated events

| AppEvent | Trigger surface | DB write | Receivers | Receiver surfaces (tabs) | Notification type | Realtime channel |
|---|---|---|---|---|---|---|
| `checkin.logged` | `LogCheckInSheet` / `/check-in/:id` | `weekly_checkins` insert + `log_checkin_crps_hours` RPC | P, A | P `/card` "Last contact" line, A engagement-pill recalc, Admin sheet Engagement strip | _(none — passive)_ | `checkins-${participantId}` |
| `checkin.low_mood` | Same, when `mood_status <= 2` | (above) + per-admin `notifications` rows | A | Admin notification bell + Admin sheet Overview risk flag | `general` (link to `/caseload/:id`) | `checkins-${participantId}` |
| `note.created` | `NotesTab` (any note_type) | `progress_notes` insert | A | Admin sheet Notes feed | _(none — passive)_ | `notes-${participantId}` |
| `note.crisis` | `NotesTab` with `note_type='crisis'` | (above) | A, **PS dashboard** | Admin red alert; Caseload card crisis dot (14-day window) | `general` (link to `/caseload/:id`) → A only | `notes-${participantId}` |
| `milestone.unlocked` | `MilestonesTab` → unlock | `participant_milestones` insert + `recalculate_card_level` RPC | P, A | P `/card` celebration toast (already wired), Admin sheet Journey | `milestone_unlocked` (P) | `milestones-${participantId}` |
| `level_up` | Triggered by `card_level` change after milestone | `notifications` insert (P) | P | `/card` toast + bell + `/notifications` page | `level_up` (P) | `card-level-${participantId}` |
| `peer_request.responded` | PS approves/declines a request | `peer_requests.status` UPDATE + `participant_profiles.assigned_peer_id` if approved | P, A | P `/card` Stage 3 banner flip, A dashboard "Unassigned" recount | `peer_request_approved` / `peer_request_declined` (P) | `peer-requests-${peerId}` + `card-level-${participantId}` |
| `referral.created` | `TransitionsTab` → create | `referrals` insert | P, A | P `/resources` highlight, Admin sheet Notes Compliance | `referral_received` (P) | _(none — manual refresh)_ |
| `self_care.flagged` | `/self-care` submit, when stress≥4 OR mood≤2 | `self_care_checks` insert with `is_flagged=true` | A | `AdminDashboardPage` "Self-care alerts" widget | `general` (A) | _(none — admin polls)_ |
| `self_care.overdue` | Cron / dashboard derive (no submit in 7d) | _(no DB write — derived)_ | A | Admin dashboard "Self-care overdue" indicator on peer row | _(none — UI derived)_ | _(none)_ |

## Admin-originated events

| AppEvent | Trigger surface | DB write | Receivers | Receiver surfaces (tabs) | Notification type | Realtime channel |
|---|---|---|---|---|---|---|
| `peer.approved` | `AdminPeerReviewPage` | `peer_specialist_profiles.approval_status='approved'` | PS | PS holding screen → `/caseload` route | `peer_application_approved` | `peer-status-${peerUserId}` |
| `peer.rejected` | Same | `approval_status='rejected'` + `rejection_reason` | PS | PS rejection screen | `peer_application_rejected` | `peer-status-${peerUserId}` |
| `peer.suspended` | `AdminPeersPage` | `approval_status='suspended'` | PS | PS suspended screen | `general` | `peer-status-${peerUserId}` |
| `peer.edits_approved` | `AdminPeerDetailPage` apply pending edits | `peer_specialist_profiles.pending_edits=null` + live fields updated | PS | PS profile update | `peer_edits_approved` | `peer-status-${peerUserId}` |
| `participant.assigned_peer` | `AdminParticipantDetailSheet` assign | `participant_profiles.assigned_peer_id` UPDATE | P, PS | P `/card` Stage 3 banner, PS caseload row appears | `new_participant` (PS) | `card-level-${participantId}` + `caseload-${peerUserId}` |
| `assessment.confirmed` _(also peer-originated)_ | Admin sheet Journey "Confirm" | `assessment_sessions.confirmed_by` UPDATE | P | `/card` RC pill | _(none — realtime)_ | `assessments-${participantId}` |
| `supervisor_feedback.created` | Admin sheet Care Team | `supervisor_feedback` insert | PS | PS bell + `/caseload/:id` Care Team tab badge | `supervisor_feedback` (PS) | `feedback-${peerUserId}` |
| `payment.recorded` | `AdminPaymentsPage` | `payment_records` insert | P | `/payments` ledger | _(none — passive)_ | _(none)_ |
| `agreement.published` | `AdminAgreementsPage` new version | `program_agreements` insert | P (all in program) | `/agreements` "New agreement" | `agreement_updated` | _(none — manual)_ |
| `crps.eligible` | Admin verify CRPS hour threshold | `peer_specialist_profiles.crps_status='eligible'` | PS | PS `/crps` page | `crps_eligible` | `peer-status-${peerUserId}` |

---

## How to add a new event

1. **Pick a name** in `verb.noun` form (`note.created`, not `created_note`). Add it to the `AppEvent` union in `src/lib/events.ts`.
2. **Add a row to this table** with trigger, DB write, receivers, surfaces, notification type, realtime channel.
3. **Wire `emitEvent("your.event", { ... })`** at the trigger site instead of writing to `audit_log`/`notifications` directly.
4. **If the receiver UI relies on realtime**, add the channel name to `src/lib/realtime-channels.ts` and import the constant on both sides.
5. **Update `docs/role-surface-matrix.md`** so every receiver surface lists the new signal in its required-signals column.
6. **If the event is meant to move a participant up the RCA ladder**, add it to the relevant domain in `docs/recovery-capital-ladder.md`.

If you ship a feature that violates any of the above, the contract has drifted — open a follow-up to reconcile before merging more.
