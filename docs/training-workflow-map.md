# Training Workflow Map (Phase 3)

> **Purpose.** Translate the [Coverage Inventory](./training-coverage-inventory.md) §7 into
> real-world operational scenarios. Every workflow below is built from the inventory
> (never from memory) and is the source for Phase 4 (quick-start) and Phase 5 (full
> reference) manuals.
>
> **Format.** Each workflow uses the same five-part structure so manuals can be generated
> consistently:
>
> 1. **Trigger** — what real-world event starts this
> 2. **Actor & surface** — who responds, where, in what state
> 3. **Step-by-step** — exact in-app actions, in order, with surface references
> 4. **Expected result** — what the actor should see (toast, state change, navigation)
> 5. **Cross-role impact** — what other roles see, on which surface, via which signal
>
> **Coverage discipline.** Every workflow ID below maps back to:
> - one or more inventory rows (P-#, PS-#, A-#, G-#)
> - one or more rows in `docs/interdependency-map.md` (event contract)
> - the gating row in `docs/training-coverage-matrix.md`
>
> If a workflow references a surface that is not in the inventory, the inventory is wrong
> — fix the inventory first, not the workflow.

---

## Reading guide

- **P** = Participant · **PS** = Peer Specialist · **A** = Admin · **G** = Global/Public
- *Italicized brackets* `[like this]` indicate the literal UI label (button, toast, tab)
- ⚡ = realtime channel fires · 🔔 = `notifications` row inserted · 📜 = `audit_log` row written
- **Edge states** are listed at the bottom of each workflow — every manual section MUST
  describe at least the empty, pending, error, and overdue/expired variants where they
  apply

---

## WF-01. Onboarding (new participant first run)

**Inventory rows:** G-2, G-3, G-4, P-1
**Event-contract rows:** _(none — pre-account; first signal fires at WF-03)_

### Trigger
A new person hits the public landing page or is handed an intake link by a peer/admin.

### Actor & surface
- **G** unauthenticated visitor → `/` `LandingPage.tsx`
- After signup → **P** authenticated → `/profile/setup` → `/card`

### Step-by-step
1. Visitor clicks **Intake** on `/` → routes to `/intake` `IntakePage.tsx`.
2. Step 1 *Account* — email + password → DB trigger creates `users` row (`role='participant'`) + skeleton `participant_profiles`.
3. Step 2 *About You* — name, DOB, phone, photo (≤ 5 MB).
4. Step 3 *Recovery* — substance(s) (incl. "add custom"), program, recovery pathway.
5. Submit → toast *"Intake complete!"* → completion screen → CTA to `/card`.
6. First arrival on `/card` shows: empty RC sparkline, no plan, no peer assigned (Stage 3 banner CTA → `/peers/browse`), level badge **ROOKIE**.

### Expected result
- `participant_profiles` populated; `card_level='rookie'`
- `/card` renders with empty-state placeholders (no assessments yet, no plan yet)

### Cross-role impact
- **A** dashboard `unassigned_participants` widget count +1 (immediate, on next refresh)
- **A** `/admin/participants` "needs" tab shows the new row

### Edge states
- Validation per step (required fields)
- Photo > 5 MB → error toast, intake blocked at step 2
- Browser refresh mid-wizard → wizard resets (no draft persistence — call out in training)
- Email already in use → auth error toast

---

## WF-02. Peer request → approval (Stage 3 unlock)

**Inventory rows:** P-10, PS-2, A-1
**Event-contract rows:** `peer_request.created`, `peer_request.cancelled`, `peer_request.responded`, `participant.assigned_peer`

### Trigger
Participant decides they want a peer (Stage 3 banner CTA on `/card` or self-navigation to `/peers/browse`).

### Actor & surface
- **P** on `/peers/browse` `PeerBrowsePage.tsx`
- Then **PS** on `/caseload` `CaseloadPage.tsx` *Pending Requests* section

### Step-by-step
1. **P** browses available approved peers → clicks **Request** on a card.
   - 🔔 `peer_request_received` → PS bell + `/notifications`
   - ⚡ `peer-requests-${peerId}` channel updates PS `/caseload`
2. **PS** sees the row in *Pending Requests* on `/caseload`.
3. **PS** clicks **Approve** (toast *"Request approved"*) or **Decline** (toast *"Request declined"*).
   - On approve: `participant_profiles.assigned_peer_id` is set; `peer_requests.status='approved'`.
   - 🔔 `peer_request_approved` or `peer_request_declined` → **P**.
   - ⚡ `card-level-${participantId}` flips P's Stage 3 banner.
4. **P** sees Stage 3 banner change to *"Your peer: {name}"* on `/card`.

### Expected result
- P's `/card` shows assigned peer; `/peers/browse` shows the same peer as *current*.
- PS's `/caseload` list now contains the participant (caseload row appears via `caseload-${peerUserId}` channel).

### Cross-role impact
- **A** dashboard `unassigned_participants` count -1.
- **A** `/admin/participants` row moves out of "needs" tab.

### Edge states
- **P** cancels request before PS responds → `/peers/browse` returns to *no pending request*; toast *"Request cancelled."*; PS row removed.
- **P** requests a different peer while one is already approved → triggers **Switch** dialog (alert *"Switch request?"*) — covered as a sub-path of this workflow.
- PS declines without reason → P sees declined notification, can re-request a different peer.

---

## WF-03. Assessment cycle (self-assess → confirm → plan generated)

**Inventory rows:** P-3, P-4, PS-7 (AssessmentsTab), A-4
**Event-contract rows:** `assessment.completed`, `assessment.confirmed`

### Trigger
- First-time participant (no assessment yet) — **plan generation depends on this**
- Recurring assessment cadence

### Step-by-step
1. **P** opens `/assessment/take` `AssessmentTakePage.tsx`.
2. **P** scores each domain → reviews → submits → toast *"Assessment submitted!"*.
   - DB writes: `assessment_sessions` insert + `assessment_scores` inserts.
   - 🔔 `assessment_ready_for_review` → PS.
   - **Server-side: if first-ever assessment**, `generate_recovery_plan(p_participant_id)` RPC fires automatically — DO NOT call from client. (See P-5.)
   - ⚡ `assessments-${participantId}`.
3. **PS** sees pending review on `/caseload` card RC pill, or via Admin sheet *Journey* tab.
4. **PS** (or **A**) opens *AssessmentsTab* → clicks **Confirm score** → toast *"Assessment confirmed!"*.
   - DB write: `assessment_sessions.confirmed_by` set.
   - ⚡ `assessments-${participantId}` flips P's `/card` RC pill from *unconfirmed* → *confirmed*.

### Expected result
- P's `/card` RC sparkline shows *confirmed* pill.
- P's `/assessment/history` shows the new session in the timeline.
- If first assessment: P's `/plan` populates with 4 phases (30/60/90/six_month) from a `plan_template`.

### Cross-role impact
- **A** `/admin/participants` *Pending Assessment* widget decrements.
- **PS** caseload card RC pill updates.

### Edge states
- Submitted but not yet confirmed → `/card` shows *unconfirmed* pill.
- First assessment but plan not yet visible to P → realtime delay: tell P to refresh `/plan` (verified in training).
- Re-submission before confirmation → previous session remains in history; PS confirms most recent.

---

## WF-04. Plan generation & progression

**Inventory rows:** P-5, PS-7 (PeerPlanTab)
**Event-contract rows:** `plan_step.completed`, `phase.advanced`

### Trigger
- **Auto:** first assessment completes (see WF-03)
- **Manual:** PS adds/edits steps via `PeerPlanTab`

### Step-by-step (participant-side completion)
1. **P** opens `/plan` → sees active phase (30/60/90/six_month) and step list.
2. **P** checks a step → optimistic UI update.
   - DB write: `plan_action_steps.is_completed=true`.
   - ⚡ `plan-${participantId}` notifies PS + A.
3. When phase completion ratio crosses threshold → `phase.advanced` event fires; next phase auto-activates.
   - PS/A see *"Phase advanced"* line on Engagement tab.

### Step-by-step (peer-side editing)
1. **PS** opens caseload participant → *PeerPlanTab*.
2. **PS** can: add step / edit step / remove step (toasts) / Manual unlock phase (alert *"Unlock {phase} phase?"*).

### Expected result
- P always sees the **active** phase first; locked future phases visible but greyed.
- PS sees real-time step completions on Journey tab.

### Cross-role impact
- **A** sheet Journey shows progress and phase advancement timeline.

### Edge states
- No plan yet (pre-first-assessment) → `/plan` empty state with copy *"Complete your first assessment to generate your plan."*
- All steps in phase complete but `phase.advanced` not yet fired (rare race) → PS can manual-unlock.
- PS removes a completed step → completion ratio recalculates.

---

## WF-05. Weekly check-in cycle

**Inventory rows:** PS-5, PS-6, PS-7 (CheckInsTab), P-11, A-9
**Event-contract rows:** `checkin.logged`, `checkin.low_mood`

### Trigger
PS's weekly cadence with each caseload participant.

### Step-by-step
1. **PS** uses one of:
   - `/caseload/:participantId/checkin` (full page form)
   - `/checkin/:participantId` (alias)
   - `LogCheckInSheet` opened from caseload row quick action
2. PS fills required fields → **Save** → toast *"Check-in saved"*.
   - DB writes: `weekly_checkins` insert.
   - **Always call `log_checkin_crps_hours(p_checkin_id, p_peer_id)` RPC immediately after** — credits PS hours.
   - ⚡ `checkins-${participantId}`.
3. If `mood_status ≤ 2` → **also** fires `checkin.low_mood`:
   - 🔔 `general` notification → A bell + Admin sheet *Overview* risk flag.

### Expected result
- **P** `/card` "Last contact" line updates.
- **P** `/checkins` shows new row.
- **PS** `/peer/checkins` aggregated count increments.
- PS CRPS hours total increases (`/crps`).

### Cross-role impact
- **A** sheet *Engagement* 8-week strip updates; engagement pill recolors if cadence improves.

### Edge states
- Required fields missing → validation toast *"Please complete all required fields"*.
- Low-mood path → A notification AND PS caseload card retains low-mood signal until next non-low check-in.
- No check-in in 14 days → caseload card crisis dot may appear (also driven by crisis notes — see WF-06).

---

## WF-06. Notes & crisis handling

**Inventory rows:** PS-7 (NotesTab), A-11
**Event-contract rows:** `note.created`, `note.crisis`

### Trigger
PS observes something worth recording: general progress, milestone context, referral context, transition context, or **crisis**.

### Step-by-step
1. **PS** opens caseload participant → *NotesTab* → dialog *"New Progress Note"*.
2. PS picks `note_type`: general / milestone / referral / transition / **crisis**.
3. Submit → DB write: `progress_notes` insert.
   - All types: 📜 + Admin sheet *Notes* feed updates.
   - **Crisis only:** toast *"Note flagged for supervisor review. Remember to complete your self-care check."*
     - 🔔 `general` → A bell.
     - **A** dashboard red alert.
     - **PS** caseload card shows crisis dot for **14 days**.
4. After a crisis note, training expects PS to navigate to `/crps/selfcare` (see WF-14).

### Expected result
- Note visible on Admin sheet *Notes* tab in chronological feed.
- Participant cannot see notes — internal only.

### Cross-role impact
- **A** `/admin/participants/:id/notes` read-only feed includes crisis flags.

### Edge states
- Crisis dot persistence: even if mood improves, dot stays the full 14 days unless overridden.
- Multiple crisis notes within 14 days → dot remains; alerts re-fire each time.

---

## WF-07. Milestone unlock → level-up celebration

**Inventory rows:** PS-7 (MilestonesTab), P-1 (level badge), P-2
**Event-contract rows:** `milestone.unlocked`, `level_up`

### Trigger
PS verifies a participant has completed a milestone criterion.

### Step-by-step
1. **PS** opens *MilestonesTab* → clicks **Unlock** on the milestone → dialog *"Unlock: {name}"* confirms.
   - DB writes: `participant_milestones` insert.
   - **Always call `recalculate_card_level(p_participant_id)` RPC** — never compute client-side.
   - ⚡ `milestones-${participantId}`.
   - 🔔 `milestone_unlocked` → P.
2. If milestone count crosses a level threshold (4, 7, or 10) → `card_level` enum updates → `level_up` event:
   - ⚡ `card-level-${participantId}`.
   - 🔔 `level_up` → P.
   - **P** `/card` fires celebration toast (5s) + level badge changes (ROOKIE → STARTER → VETERAN → ALL-STAR).

### Expected result
- **P** `/milestones` moves the milestone from *locked* to *unlocked*.
- **P** `/card` shows new badge.
- **A** Admin sheet *Journey* shows unlock entry.

### Cross-role impact
- A reports/dashboard count milestone events.

### Edge states
- PS removes a milestone (rare) → `recalculate_card_level` must run again — level can drop. Training must call this out so PS understands the consequence.
- Level thresholds: 0–3 rookie · 4–6 starter · 7–9 veteran · 10+ all-star.

---

## WF-08. Referrals & resources (placement + discharge)

**Inventory rows:** P-6, P-7, PS-7 (TransitionsTab), A-8 (resources)
**Event-contract rows:** `referral.created`

### Trigger
- **P-initiated:** participant clicks *"Request Next Placement"* on `/resources` (notifies assigned peer; not a `referrals` row yet).
- **PS-initiated:** PS creates referral via *TransitionsTab*.

### Step-by-step
1. **PS** opens caseload participant → *TransitionsTab* → **Start Referral** dialog.
2. Fill partner (`community_partners`), notes, optional passport link → submit → toast *"Referral created"*.
   - DB write: `referrals` insert (`referred_by` = PS user_id; `partner_id` → `community_partners`).
   - 🔔 `referral_received` → P.
3. Participant sees highlighted resource on `/resources`.
4. When discharge complete → PS opens *Discharge Summary* dialog → **Sign off** (toast *"Signed off"*) → **Mark completed** (toast *"Marked as completed"*).

### Expected result
- `referrals.status` lifecycle: created → in_progress → completed.
- A compliance feed on Admin sheet *Notes* shows the referral.

### Cross-role impact
- **A** has full read on referrals via reporting and audit.

### Edge states
- Referrals are **always created by PS**, never by P (training must enforce this).
- Resource directory ≠ referrals: `community_partners` is the directory; `referrals` is the discharge record.
- Discharge cannot complete without sign-off.

---

## WF-09. Agreements & compliance

**Inventory rows:** P-12, A-8 (`/admin/content/agreements`)
**Event-contract rows:** `agreement.published`, `agreement.acknowledged`

### Trigger
- **A** publishes a new or updated agreement for a program.

### Step-by-step
1. **A** opens `/admin/content/agreements` → edits or adds version → **Publish** → toast *"Agreement published"*.
   - DB write: `program_agreements` insert (new version row; older versions remain for history).
   - 🔔 `agreement_updated` → all P in that program.
2. **P** sees new badge on `/agreements`.
3. **P** opens agreement → **Acknowledge** → toast *"Agreement acknowledged"*.
   - DB write: `agreement_acknowledgments` insert.
   - Admin sheet *Notes* compliance line updates.

### Expected result
- Acknowledgments roll up into A's compliance reporting.

### Cross-role impact
- **A** `/admin/audit` shows publish + each acknowledgment as audit events (where wired).

### Edge states
- Version superseded — older versions visible in history but only the latest is acknowledgable.
- P switches programs → agreements list reflects new program's set.

---

## WF-10. Passport sharing (P generates → consent → share/QR → revoke/expire)

**Inventory rows:** P-8 (`/passport`), G-5 (`/passport/:token`), A-13
**Event-contract rows:** `consent.created`, `shared_link.created`

### Trigger
P needs to share their progress with an external party (treatment provider, court, family).

### Step-by-step
1. **P** opens `/passport` `PassportConfigPage.tsx`.
2. Fills recipient, purpose, picks section toggles (7 sections; **payment_history is locked OFF**), expiry (24h / 7d / 30d / none).
3. Reads 42 CFR redisclosure notice (pulled from `app_config.cfr42_redisclosure_notice`) → checks consent acknowledgment.
4. Clicks **Generate link** → toast *"Passport link generated"*.
   - DB writes: `consent_records` insert + `shared_links` insert.
   - 📜 visible on `/admin/audit`.
5. Secondary actions:
   - **Copy URL** → toast *"Copied to clipboard"*
   - **Share** (system share sheet)
   - **Download QR**
   - **Revoke** (alert dialog *"Revoke this link?"*) → toast *"Link revoked"*
6. **G** external viewer opens `/passport/:token` (anonymous):
   - **Must call `get_shared_link_by_token(p_token)` RPC** (anon RLS-blocked from direct query).
   - **Must call `log_passport_view(p_token)` RPC** (anon cannot insert into `audit_log` directly).

### Expected result
- Viewer sees only the toggled-on sections; sees 42 CFR redisclosure notice.
- A audit log records every view.

### Cross-role impact
- **A** `/admin/audit` is the compliance source of truth.

### Edge states
- Consent not acknowledged → **Generate** disabled.
- Link expired → public page shows expired state.
- Link revoked → public page shows revoked state.
- Invalid token → invalid-token state.
- 42 CFR copy must come from `app_config` — never hardcoded in training screenshots.

---

## WF-11. Payments

**Inventory rows:** A-10 (`/admin/participants/:id/payments`), P-13 (`/payments`)
**Event-contract rows:** `payment.recorded`

### Trigger
Stipend / reimbursement / fine adjustment by admin.

### Step-by-step
1. **A** opens `/admin/participants/:id/payments` → fills entry → submit → toast *"Entry logged"*.
   - DB write: `payment_records` insert.
2. **P** sees new ledger row on `/payments`.

### Expected result
- Ledger is read-only for P; A is sole writer.

### Cross-role impact
- Payment section is **locked OFF by default** in passport sharing (WF-10) for privacy.

### Edge states
- Empty ledger for P → empty state.

---

## WF-12. Reports (admin filter → generate → export/print → audit)

**Inventory rows:** A-12 (`/admin/reports`)
**Event-contract rows:** _(audit-only — `audit_log` write on report generation)_

### Trigger
A needs program metrics for a funder, a board meeting, or internal review.

### Step-by-step
1. **A** opens `/admin/reports` `AdminReportsPage.tsx`.
2. Sets **Start date** + **End date** (Calendar pickers).
3. Optionally filters by **program/location**.
4. Clicks **Generate Report**.
   - Validation: missing range → toast *"Select date range"*.
5. Sections render: *Participant Volume · Stabilization · Recovery Progress · Workforce · Referrals*.
6. Secondary actions:
   - **CSV Export** → file download
   - **Print** → browser print dialog (print stylesheet included)
7. 📜 generation writes to `audit_log` (who, when, range, filter).

### Expected result
- A walks away with a date-bounded artifact suitable for funders.

### Cross-role impact
- **A** only.

### Edge states
- No data in range → empty section placeholders, not a hard error.
- Very large date range → loader; if hits 15s safety cap, dashboard pattern applies.
- CSV import into Excel — call out UTF-8 BOM if needed.

---

## WF-13. Notifications (cross-role)

**Inventory rows:** G-6 (`/notifications`), G-7 (`NotificationBell`)
**Event-contract rows:** every row in interdependency-map.md that has a non-empty `Notification type`

### Trigger
Any cross-role event with a `notification_type`.

### Step-by-step
1. Recipient sees unread badge on `NotificationBell` (sticky in every layout header).
2. Clicks bell → dropdown of latest N → row click marks-read + deep-links.
3. Or opens `/notifications` `NotificationsPage.tsx`:
   - Mark single read
   - **Mark all read**
   - Filter / scroll
4. Notification types in scope (full list in inventory G-6):
   `level_up`, `milestone_unlocked`, `peer_request_received/approved/declined/cancelled`,
   `new_participant`, `assessment_ready_for_review`, `supervisor_feedback`,
   `peer_application_approved/rejected`, `peer_edits_approved`, `agreement_updated`,
   `referral_received`, `crps_eligible`, `general` (low-mood, crisis-note, self-care).

### Expected result
- Each notification deep-links to the originating surface.

### Cross-role impact
- Notification system is the **glue** for every other workflow.

### Edge states
- Empty state when no notifications.
- Realtime drift — page refresh resyncs.

---

## WF-14. Peer wellness & CRPS

**Inventory rows:** PS-8 (`/crps`), PS-9 (`/crps/selfcare`), A-7 (`/admin/peers/:peerId`), A-1 (dashboard self-care widget)
**Event-contract rows:** `self_care.flagged`, `self_care.overdue`, `crps.eligible`

### Trigger A — Self-care submission
1. **PS** opens `/crps/selfcare` `SelfCarePage.tsx`.
2. Logs mood (1–5), energy (1–5), stress (1–5), notes → submit → toast *"Self-care check completed"*.
   - DB write: `self_care_checks` insert with `is_flagged = (stress ≥ 4 OR mood ≤ 2)`.
3. If flagged → A dashboard *Self-care alerts* widget surfaces it.

### Trigger B — Self-care overdue (no submit in 7 days)
- Derived signal (no DB write) → A dashboard shows *Self-care overdue* indicator on the peer's row.

### Trigger C — Hours log + CRPS eligibility
1. **PS** opens `/crps` `CrpsPage.tsx` → reviews 6 tools + 6 skills + hours log + status.
2. PS may **Log Manual Hours** dialog → toast *"Hours logged"*.
3. **A** opens `/admin/peers/:peerId` → *verify* tab → **Verify Hours** (toast *"Hours verified"*) and/or **Verify Competency** (toast *"Competency verified"*).
4. When threshold met → `crps.eligible` event → 🔔 `crps_eligible` → PS.

### Expected result
- PS knows their CRPS state at all times via `/crps`.
- A has a single dashboard view for peer wellness.

### Cross-role impact
- A may use these signals in coaching / supervisor feedback.

### Edge states
- `is_flagged` boolean derived per insert — historical rows do not retroactively change.
- Overdue indicator clears as soon as PS submits a new check.
- Eligibility status enum: `not_started · in_progress · verified · eligible`.

---

## WF-15. Admin oversight (dashboard → drill-in → action)

**Inventory rows:** A-1, A-3, A-4, A-5, A-6
**Event-contract rows:** all signals that surface on dashboard alerts

### Trigger
Daily admin login.

### Step-by-step
1. **A** opens `/admin` `AdminDashboardPage.tsx`.
2. Reviews metric cards: total active, total peers, avg RC, referrals.
3. Triages alert items in priority order:
   - **Red:** overdue check-ins, crisis notes
   - **Amber:** pending assessments
   - **Purple:** pending peer applications
   - **Blue:** unassigned participants
4. Reviews peer overview: caseload count, compliance %, CRPS progress, last activity, **self-care overdue indicator**.
5. Drills into the appropriate destination:
   - Crisis note → `/admin/participants/:id/notes`
   - Pending assessment → `/admin/participants` *needs* tab → sheet *Journey* → confirm
   - Pending peer app → `/admin/peers` *pending* tab → approve/reject (dialog *Reject Application* requires reason)
   - Unassigned participant → `/admin/participants` → sheet → **Assign peer** → 🔔 `new_participant` to PS
6. Supervisor feedback (any time): Admin sheet *Care Team* → add feedback → 🔔 `supervisor_feedback` to PS.

### Expected result
- Every red alert acted on or explicitly snoozed.
- Pending queues drained.

### Cross-role impact
- Every admin action above produces a downstream signal — see WF-2, WF-3, WF-15.

### Edge states
- 15-second loader timeout on dashboard — if a section can't load, UI does not block the rest.
- DemoControls present — alert dialog *"Clear all demo data?"* (must be in admin training so admins know NOT to click this in production-like data).

---

## WF-16. Public passport view (anonymous viewer)

**Inventory rows:** G-5 (`/passport/:token`)
**Event-contract rows:** _(view-only; writes audit row via RPC)_

### Trigger
External party opens a passport URL or scans a QR.

### Step-by-step
1. **G** opens `/passport/:token` `PublicPassportPage.tsx`.
2. App calls `get_shared_link_by_token(p_token)` (SECURITY DEFINER, anon-granted).
3. App calls `log_passport_view(p_token)` (SECURITY DEFINER, anon-granted) — DO NOT insert into `audit_log` directly from anon context.
4. Page renders only the sections the participant toggled on.
5. 42 CFR redisclosure notice rendered from `app_config`.

### Expected result
- Viewer gets a read-only card.
- Each view appears in `/admin/audit`.

### Cross-role impact
- **A** alone consumes audit footprint.

### Edge states
- Valid · expired · revoked · invalid token (each is its own visible state — must all appear in training screenshots).

---

## Coverage cross-check (gate before Phase 4)

This map covers all 16 workflows in `training-coverage-inventory.md` §7. Before Phase 4
opens, each workflow above must be tied to:

| Workflow | Inventory rows | Event-contract rows | Matrix gate row |
|---|---|---|---|
| WF-01 | G-2, G-3, G-4, P-1 | _(none — pre-account)_ | TCM-W1 |
| WF-02 | P-10, PS-2, A-1 | peer_request.* / participant.assigned_peer | TCM-W2 |
| WF-03 | P-3, P-4, PS-7, A-4 | assessment.completed/confirmed | TCM-W3 |
| WF-04 | P-5, PS-7 | plan_step.completed / phase.advanced | TCM-W4 |
| WF-05 | PS-5, PS-6, PS-7, P-11, A-9 | checkin.logged / checkin.low_mood | TCM-W5 |
| WF-06 | PS-7, A-11 | note.created / note.crisis | TCM-W6 |
| WF-07 | PS-7, P-1, P-2 | milestone.unlocked / level_up | TCM-W7 |
| WF-08 | P-6, P-7, PS-7, A-8 | referral.created | TCM-W8 |
| WF-09 | P-12, A-8 | agreement.published / agreement.acknowledged | TCM-W9 |
| WF-10 | P-8, G-5, A-13 | consent.created / shared_link.created | TCM-W10 |
| WF-11 | A-10, P-13 | payment.recorded | TCM-W11 |
| WF-12 | A-12 | _(audit-only)_ | TCM-W12 |
| WF-13 | G-6, G-7 | every notif-bearing event | TCM-W13 |
| WF-14 | PS-8, PS-9, A-7, A-1 | self_care.* / crps.eligible | TCM-W14 |
| WF-15 | A-1, A-3..A-6 | (every signal surfaced on dashboard) | TCM-W15 |
| WF-16 | G-5 | _(view-only — audit RPC)_ | TCM-W16 |

If any inventory row is **not** referenced by at least one workflow above, that row is
either (a) a passive surface that's covered only in the reference manual (acceptable) or
(b) a missed workflow that must be added before Phase 4. The next phase will reconcile.

---

## Phase 3 → Phase 4 handoff

Phase 4 (quick-start guides) MUST:

1. Pick the **highest-frequency 5–8 workflows per role** from the table above.
2. Compress each chosen workflow into a one-page card-style instruction.
3. Use the same five-part structure (Trigger / Actor / Steps / Result / Cross-role impact).
4. Cite the WF-## ID of every quick-start so reconciliation in Phase 6 is mechanical.

Phase 5 (full reference manuals) MUST:

1. Cover **every** WF-## above.
2. Plus every inventory row not referenced by a WF-## (passive surfaces, settings, edge
   utilities like Offline banner, Install prompt, 404).
3. Tag each section with certainty level: *verified · needs screenshot · needs walkthrough wording · needs scenario*.

Phase 6 reconciliation runs the matrix in `training-coverage-matrix.md` against this
file, the inventory, and the produced manuals — anything missing gets fixed before any
material is exported as PDF.
