# Task Playbook (Staff Training)

> **What this is.** The single source of truth for all Recovery Passport staff training.
> Every entry below is **one job a real person sits down to do** — a discrete task with a
> goal, a place, steps, and a clear "done" state.
>
> **What this is not.** This is not a system reference. For trigger-oriented engineering
> material (what fires when an event happens, what RPCs run, what notifications emit),
> see [`docs/system-event-map.md`](./system-event-map.md).
>
> **Source discipline.** Every task is gated against [`training-coverage-inventory.md`](./training-coverage-inventory.md).
> Tasks may span multiple inventory rows. Inventory rows not yet covered by any task are
> listed in the **Reconciliation** section at the bottom.

---

## Reading guide

Each task uses this fixed shape:

```text
TASK ID:   T-{ROLE}-{##}        e.g. T-ADMIN-04
TITLE:     Verb-led one-liner
ROLE:      Participant | Peer Specialist | Admin
CADENCE:   Daily | Weekly | Periodic | One-time | As-needed
TIME:      Approx. minutes
GOAL:      One sentence — why you do this
WHERE:     Exact route(s)
PREREQS:   What must already exist
STEPS:     Numbered, click-by-click
RESULT:    What success looks like (toast, screen state, exported file)
IF SOMETHING'S OFF:  2–3 common edge cases
LINKED:    Inventory rows touched · system events triggered
```

Legend used in steps:
- 🖱 click / tap
- ⌨ type / fill
- 👁 read / verify
- 🔔 a notification will fire to another role
- 📜 an audit log entry is written
- ⚡ realtime channel update

---

# 1. Participant Tasks

## Daily

### T-PART-01 — Open your Card and check today's focus
- **Cadence:** Daily · **Time:** ~1 min
- **Goal:** See where you stand today and what's recommended for you.
- **Where:** `/card`
- **Prereqs:** Profile created.
- **Steps:**
  1. 🖱 Open the app — you land on `/card`.
  2. 👁 Read the **Card header** (your level: Rookie, Starter, Veteran, or All-Star).
  3. 👁 Read **Today Focus** card.
  4. 👁 Glance at **Streak Stats** and **Resource of the Day**.
- **Result:** You know your current level and what's suggested for today.
- **If something's off:**
  - No assigned peer? You'll see a Stage 3 banner — go to T-PART-09 to request one.
  - Card looks empty / no RC sparkline? You haven't done your first assessment — go to T-PART-04.
- **Linked:** P-1 · no events fired

### T-PART-02 — Log your mood
- **Cadence:** Daily · **Time:** ~30 sec
- **Goal:** Track mood so you and your peer can see patterns.
- **Where:** `/card` → Mood widget
- **Steps:**
  1. 🖱 On the Card, find the **Mood widget**.
  2. 🖱 Tap a mood emoji.
- **Result:** Toast: *"Mood logged 💛"*. Streak updates.
- **If something's off:** Already logged today? It will overwrite. That's okay.
- **Linked:** P-1 (MoodWidget) · no cross-role event

### T-PART-03 — Write a journal reflection
- **Cadence:** Daily (recommended) · **Time:** 1–3 min
- **Goal:** Capture a thought, win, or struggle privately.
- **Where:** `/card` → Reflection Journal
- **Steps:**
  1. 🖱 Open the **Reflection Journal** card.
  2. ⌨ Write your reflection.
  3. 🖱 Save.
- **Result:** Toast: *"Saved to your journal."*
- **If something's off:** Error toast — check connection (Offline banner shows when you're disconnected).
- **Linked:** P-1 (ReflectionJournal)

## Weekly / Periodic

### T-PART-04 — Take a Recovery Capital Assessment
- **Cadence:** Periodic (first one ASAP, then quarterly) · **Time:** 8–12 min
- **Goal:** Score yourself across 10 recovery domains so a personalized plan can be generated.
- **Where:** `/assessment/take`
- **Prereqs:** Profile created.
- **Steps:**
  1. 🖱 From the Card, tap **Take Assessment** (or navigate to `/assessment/take`).
  2. ⌨ For each domain, pick the level that best describes you right now.
  3. 👁 Review the summary screen.
  4. 🖱 Submit.
- **Result:** Toast: *"Assessment submitted!"* 🔔 Your peer specialist is notified for confirmation. If this was your first assessment, your **Recovery Plan auto-generates** in the background.
- **If something's off:**
  - Stuck on one domain? Pick what's closest — you can re-take later.
  - Plan not showing on `/plan`? Wait 30 sec; refresh.
- **Linked:** P-3 · `assessment.completed` event · `generate_recovery_plan` RPC (first only)

### T-PART-05 — View your assessment history
- **Cadence:** As-needed · **Time:** ~1 min
- **Goal:** Compare past scores to track progress.
- **Where:** `/assessment/history`
- **Steps:**
  1. 🖱 From the Card sparkline, tap **History** (or navigate to `/assessment/history`).
  2. 👁 Browse the timeline; tap any session for per-domain detail.
- **Result:** You see confirmed vs unconfirmed sessions and score changes over time.
- **Linked:** P-4

### T-PART-06 — Work your Recovery Plan
- **Cadence:** Daily/weekly · **Time:** 1–5 min per session
- **Goal:** Check off steps as you complete them so phases auto-advance.
- **Where:** `/plan`
- **Prereqs:** First assessment submitted (plan exists).
- **Steps:**
  1. 🖱 Open `/plan`.
  2. 👁 Find your **active phase** (30 / 60 / 90 / 6-month).
  3. 🖱 Check off any steps you've completed.
- **Result:** Step shows complete ✓. When enough steps in a phase are done, phase auto-advances. 🔔 Peer + Admin see the update.
- **If something's off:**
  - "No plan yet" message? Take your first assessment (T-PART-04).
  - Wrong phase active? Talk to your peer — they can manually advance.
- **Linked:** P-5 · `plan_step.completed` · `phase.advanced`

### T-PART-07 — Complete a weekly check-in (read-only history)
- **Cadence:** Weekly · **Time:** ~1 min
- **Goal:** Review the check-ins your peer has logged about you.
- **Where:** `/checkins`
- **Steps:**
  1. 🖱 Navigate to `/checkins`.
  2. 👁 Browse the history of weekly check-ins.
- **Result:** You see what your peer has recorded.
- **Note:** Check-ins are logged BY your peer — you don't write them yourself. If empty, your peer hasn't logged any yet.
- **Linked:** P-11

## Periodic / As-needed

### T-PART-08 — Acknowledge a program agreement
- **Cadence:** As-needed (when a new agreement publishes) · **Time:** ~2 min
- **Goal:** Read and acknowledge program rules to stay in compliance.
- **Where:** `/agreements`
- **Trigger:** Bell shows `agreement_updated` notification.
- **Steps:**
  1. 🖱 Tap the notification or navigate to `/agreements`.
  2. 👁 Read the agreement carefully.
  3. 🖱 Tap **Acknowledge**.
- **Result:** Toast: *"Agreement acknowledged."* 🔔📜 Admin compliance log updates.
- **If something's off:** Agreement says "version superseded" — a newer version exists; acknowledge that one instead.
- **Linked:** P-12 · `agreement.acknowledged`

### T-PART-09 — Request a peer specialist
- **Cadence:** One-time (or when switching) · **Time:** ~3 min
- **Goal:** Get matched with a peer to unlock Stage 3 features.
- **Where:** `/peers/browse`
- **Steps:**
  1. 🖱 Open the Card → tap the Stage 3 banner, or navigate to `/peers/browse`.
  2. 👁 Browse approved peers; read bios + specialties.
  3. 🖱 Tap **Request** on the one you want.
  4. (If already assigned and switching) 🖱 Tap **Switch** → confirm in dialog.
- **Result:** Status shows "pending request." 🔔 That peer is notified. When they approve, your Stage 3 banner flips and the peer appears on your Card.
- **If something's off:**
  - Want to cancel? Tap **Cancel** → toast *"Request cancelled."*
  - Peer hasn't responded? Try another peer.
- **Linked:** P-10 · `peer_request.created`

### T-PART-10 — Generate a Passport share link (with consent)
- **Cadence:** As-needed · **Time:** ~3 min
- **Goal:** Share a read-only snapshot of your recovery progress with a provider, employer, or court.
- **Where:** `/passport`
- **Steps:**
  1. 🖱 Open `/passport`.
  2. ⌨ Fill **Recipient** name and **Purpose**.
  3. 🖱 Toggle which sections to include (payment history is locked OFF by default).
  4. 🖱 Choose expiry: 24h / 7d / 30d / no expiry.
  5. 👁 Read the **42 CFR Part 2 consent** preamble.
  6. ☑ Check the consent acknowledgment box.
  7. 🖱 Tap **Generate Link**.
- **Result:** Toast: *"Passport link generated."* You see Copy URL, Share, and Download QR options. 📜 Audit entry is written.
- **If something's off:**
  - Forgot to check consent? Generate button stays disabled.
  - Want to revoke later? Tap **Revoke** in the link list → confirm dialog → toast *"Link revoked."*
- **Linked:** P-8 · creates `consent_records` + `shared_links` · A audit visible

### T-PART-11 — Browse community resources
- **Cadence:** As-needed · **Time:** ~2 min
- **Goal:** Find help (food, housing, legal, medical, mental health, employment).
- **Where:** `/resources`
- **Steps:**
  1. 🖱 Navigate to `/resources`.
  2. 🖱 Filter by category.
  3. 🖱 Tap a card to view detail (`/resources/:id`).
  4. 🖱 Use Call / Directions / Share.
- **Result:** You can contact the resource directly.
- **Linked:** P-6, P-7

### T-PART-12 — Request next placement (discharge prep)
- **Cadence:** Periodic (near program end) · **Time:** ~3 min
- **Goal:** Tell your peer where you'd like to go next.
- **Where:** `/resources` → **Request Next Placement** dialog
- **Prereqs:** Assigned peer.
- **Steps:**
  1. 🖱 On `/resources`, tap **Request Next Placement**.
  2. ⌨ Fill the request fields.
  3. 🖱 Submit.
- **Result:** 🔔 Your peer specialist is notified.
- **If something's off:** "Failed to send request" toast — usually means no peer is assigned. Do T-PART-09 first.
- **Linked:** P-6

### T-PART-13 — Update your profile
- **Cadence:** As-needed · **Time:** ~2 min
- **Goal:** Edit name and photo.
- **Where:** `/profile`
- **Steps:**
  1. 🖱 Navigate to `/profile`.
  2. ⌨ Edit name fields.
  3. 🖱 Upload photo (≤ 5 MB).
  4. 🖱 Save.
- **Result:** Toast: *"Photo updated"* / *"Profile updated."*
- **If something's off:** Photo > 5 MB → resize first.
- **Linked:** P-9

### T-PART-14 — Review your payment ledger
- **Cadence:** As-needed · **Time:** ~1 min
- **Goal:** See what you've paid into the program.
- **Where:** `/payments`
- **Steps:** 🖱 Navigate to `/payments` → 👁 read ledger.
- **Result:** You see a list of `payment_records` logged by Admin.
- **Linked:** P-13

### T-PART-15 — Mark notifications as read
- **Cadence:** Daily · **Time:** ~30 sec
- **Goal:** Clear the bell badge.
- **Where:** Bell icon (top right) or `/notifications`
- **Steps:**
  1. 🖱 Tap the bell to see latest, or **See all** for full page.
  2. 🖱 Tap a row to deep-link AND mark read.
  3. 🖱 Or tap **Mark all read**.
- **Linked:** G-6, G-7

---

# 2. Peer Specialist Tasks

## Daily

### T-PEER-01 — Triage your caseload
- **Cadence:** Daily (start of shift) · **Time:** ~5 min
- **Goal:** See who needs you today — overdue check-ins, crisis dots, low engagement.
- **Where:** `/caseload`
- **Steps:**
  1. 🖱 Open `/caseload`.
  2. 👁 Read the **Caseload Health Header** (workload + your self-care reminder).
  3. 👁 Scan each card for: red **crisis dot** (active 14 days after a crisis note), **last contact** date, **engagement pill** (red/amber/green), **RC pill**.
  4. 🖱 Tap any concerning card to open detail.
- **Result:** You know who to reach out to first.
- **If something's off:**
  - Empty caseload? You haven't been assigned anyone yet — admin handles that.
  - Self-care prompt is loud? Do T-PEER-12 first.
- **Linked:** PS-2 · realtime `caseload-${peerUserId}`

### T-PEER-02 — Approve or decline a peer request
- **Cadence:** Daily (as they come in) · **Time:** ~1 min each
- **Goal:** Accept or decline new participants who chose you.
- **Where:** `/caseload` → **Pending Requests** section
- **Trigger:** Bell shows `peer_request_received`.
- **Steps:**
  1. 🖱 Open `/caseload` → scroll to **Pending Requests**.
  2. 👁 Read the requester's basic info.
  3. 🖱 Tap **Approve** or **Decline**.
- **Result:** Toast: *"Request approved"* or *"Request declined."* 🔔 Participant's Stage 3 banner flips (or they see decline).
- **If something's off:** Already at workload limit? Decline politely; admin will rebalance.
- **Linked:** PS-2 · `peer_request.approved/declined`

### T-PEER-03 — Open a participant's detail page
- **Cadence:** Daily · **Time:** ~30 sec to open
- **Goal:** Get to the full record before logging anything.
- **Where:** `/caseload/:participantId`
- **Steps:**
  1. 🖱 From `/caseload`, tap a card.
  2. 👁 Use the tabs: **Overview · Journey · Engagement · Care Team · Notes**.
- **Result:** You're in the participant detail page, ready to act.
- **Linked:** PS-3

### T-PEER-04 — Log a quick check-in (sheet)
- **Cadence:** Daily/Weekly · **Time:** ~2 min
- **Goal:** Record a brief touchpoint without leaving the caseload list.
- **Where:** `/caseload` → row quick-action **Log Check-In** sheet
- **Steps:**
  1. 🖱 On a caseload card, tap the quick-action menu → **Log Check-In**.
  2. ⌨ Fill required fields (mood status, notes, etc.).
  3. 🖱 Save.
- **Result:** Toast: *"Check-in saved."* 📜 CRPS hours auto-credited via `log_checkin_crps_hours` RPC.
- **If something's off:**
  - Validation toast ("Please complete all required fields") → fill the highlighted fields.
  - Mood ≤ 2? 🔔 Admin gets a low-mood alert automatically. That's expected.
- **Linked:** PS-5, PS-6 · `checkin.logged` · `checkin.low_mood` (conditional)

### T-PEER-05 — Add a progress note (general / milestone / referral / transition)
- **Cadence:** Daily · **Time:** ~3 min
- **Goal:** Document what happened today.
- **Where:** Participant detail → **Notes** tab → **New Progress Note** dialog
- **Steps:**
  1. 🖱 Open participant → **Notes** tab → **New Progress Note**.
  2. 🖱 Choose note type: general · milestone · referral · transition.
  3. ⌨ Write the note.
  4. 🖱 Save.
- **Result:** Note appears in feed. 🔔 Admin sees it in the participant sheet's Notes feed.
- **Linked:** PS-7 (NotesTab)

### T-PEER-06 — File a CRISIS note
- **Cadence:** As-needed (urgent) · **Time:** ~3 min
- **Goal:** Flag a safety concern; trigger supervisor review.
- **Where:** Participant detail → **Notes** tab → **New Progress Note** → type = **crisis**
- **Steps:**
  1. 🖱 Open participant → **Notes** → **New Progress Note**.
  2. 🖱 Set type to **crisis**.
  3. ⌨ Write what happened, what you observed, what you did.
  4. 🖱 Save.
- **Result:** Toast: *"Note flagged for supervisor review. Remember to complete your self-care check."* 🔔 Admin gets a red alert. Caseload card now shows a **crisis dot for 14 days**.
- **If something's off:** After filing, immediately do T-PEER-12 (self-care check) — the toast reminds you for a reason.
- **Linked:** PS-7 · `note.crisis`

## Weekly

### T-PEER-07 — Confirm a participant's assessment
- **Cadence:** Weekly · **Time:** ~3 min
- **Goal:** Review the participant's self-scored assessment and confirm it.
- **Where:** Participant detail → **Assessments** tab
- **Trigger:** Bell shows `assessment_ready_for_review`.
- **Steps:**
  1. 🖱 Open participant → **Assessments** tab.
  2. 👁 Review the latest unconfirmed session.
  3. 🖱 Tap **Confirm Score**.
- **Result:** Toast: *"Assessment confirmed!"* 🔔 Participant's RC pill on `/card` flips to "confirmed."
- **Linked:** PS-7 (AssessmentsTab) · `assessment.confirmed`

### T-PEER-08 — Unlock a milestone
- **Cadence:** As earned · **Time:** ~1 min
- **Goal:** Mark a milestone as achieved so the participant levels up.
- **Where:** Participant detail → **Milestones** tab (or quick action)
- **Steps:**
  1. 🖱 Open participant → **Milestones** tab.
  2. 🖱 Find the eligible milestone → tap **Unlock**.
  3. 🖱 Confirm in the dialog "Unlock: {name}".
- **Result:** `recalculate_card_level` RPC runs server-side. 🔔 Participant gets a celebration toast and (if level threshold crossed) a level-up event.
- **If something's off:** Unlocked the wrong one? Use the Milestones tab to remove (rare — talk to admin first).
- **Linked:** PS-7 (MilestonesTab) · `milestone.unlocked`

### T-PEER-09 — Edit a participant's plan steps
- **Cadence:** As-needed · **Time:** ~3 min
- **Goal:** Add, edit, or remove plan action steps; manually advance a phase if warranted.
- **Where:** Participant detail → **Plan** tab
- **Steps:**
  1. 🖱 Open participant → **Plan** tab.
  2. 🖱 Add / Edit / Remove steps as needed.
  3. (Optional) 🖱 **Manually unlock {phase}** → confirm dialog "Unlock {phase} phase?"
- **Result:** Toasts confirm each change.
- **Linked:** PS-7 (PeerPlanTab)

### T-PEER-10 — Start a referral (for next placement)
- **Cadence:** As-needed · **Time:** ~3 min
- **Goal:** Connect a participant to a community partner.
- **Where:** Participant detail → **Transitions** tab → **Start Referral** dialog
- **Steps:**
  1. 🖱 Open participant → **Transitions** tab → **Start Referral**.
  2. 🖱 Pick the partner (from `community_partners`).
  3. ⌨ Add notes / passport link if applicable.
  4. 🖱 Save.
- **Result:** Toast: *"Referral created."* 🔔 Admin compliance log; participant sees the highlight on `/resources`.
- **Linked:** PS-7 (TransitionsTab) · `referral.created`

### T-PEER-11 — Sign off a discharge summary
- **Cadence:** Periodic (program completion) · **Time:** ~5 min
- **Goal:** Finalize the participant's exit.
- **Where:** Participant detail → **Transitions** tab → **Discharge Summary** dialog
- **Steps:**
  1. 🖱 Open participant → **Transitions** → **Discharge Summary**.
  2. ⌨ Fill summary fields.
  3. 🖱 Sign off → toast *"Signed off."*
  4. 🖱 (Later) Tap **Mark as completed** → toast *"Marked as completed."*
- **Linked:** PS-7 (TransitionsTab)

### T-PEER-12 — Run your weekly self-care check
- **Cadence:** Weekly (mandatory) · **Time:** ~2 min
- **Goal:** Track your own mood / energy / stress; flag if you need support.
- **Where:** `/crps/selfcare`
- **Steps:**
  1. 🖱 Navigate to `/crps/selfcare`.
  2. ⌨ Rate **mood** (1–5), **energy** (1–5), **stress** (1–5).
  3. ⌨ (Optional) Add notes.
  4. 🖱 Submit.
- **Result:** Toast: *"Self-care check completed."* If stress ≥ 4 OR mood ≤ 2, it auto-flags and 🔔 Admin sees the alert on their dashboard.
- **If something's off:** Skip a week and you become "self-care overdue" on the admin dashboard.
- **Linked:** PS-9 · `self_care.flagged` (conditional)

### T-PEER-13 — Log manual CRPS hours
- **Cadence:** Weekly · **Time:** ~2 min
- **Goal:** Record peer-support hours that didn't come from check-ins.
- **Where:** `/crps` → **Log Manual Hours** dialog
- **Steps:**
  1. 🖱 Open `/crps`.
  2. 🖱 Tap **Log Manual Hours**.
  3. ⌨ Hours, activity description.
  4. 🖱 Submit.
- **Result:** Toast: *"Hours logged."* Hours total updates; if eligibility threshold met, 🔔 you get a `crps.eligible` notification.
- **Linked:** PS-8

## Periodic / As-needed

### T-PEER-14 — Review your aggregated check-in history
- **Cadence:** Weekly · **Time:** ~2 min
- **Goal:** See all check-ins you've logged across your caseload.
- **Where:** `/peer/checkins`
- **Steps:** 🖱 Navigate → 👁 review.
- **Linked:** PS-11

### T-PEER-15 — Edit your peer profile (bio / specialties / photo)
- **Cadence:** As-needed · **Time:** ~5 min
- **Goal:** Keep your public-facing peer profile current.
- **Where:** `/peers/profile`
- **Steps:**
  1. 🖱 Open `/peers/profile`.
  2. ⌨ Edit bio, specialties, photo.
  3. 🖱 Save.
- **Result:** Toast: *"Profile updated. Bio/specialty changes are pending admin review."* (Edits go to `pending_edits` JSONB — admin must approve before they go live.)
- **If something's off:** Forgot what's pending? It's listed on your profile until approved.
- **Linked:** PS-10

### T-PEER-16 — Acknowledge supervisor feedback
- **Cadence:** As-received · **Time:** ~1 min
- **Goal:** See feedback from admin and act on it.
- **Where:** Bell → `supervisor_feedback` notification
- **Steps:**
  1. 🖱 Tap the notification.
  2. 👁 Read the feedback in the participant detail Care Team tab.
- **Linked:** PS-2 (feedback realtime), PS-3

### T-PEER-17 — Use the legacy participant detail view
- **Cadence:** Rare · **Time:** varies
- **Goal:** Access the older tabs view if needed.
- **Where:** `/caseload/:participantId/legacy`
- **Linked:** PS-4

---

# 3. Admin Tasks

## Daily

### T-ADMIN-01 — Triage the dashboard
- **Cadence:** Daily (start of shift) · **Time:** ~5 min
- **Goal:** See what needs attention today across the whole program.
- **Where:** `/admin`
- **Steps:**
  1. 🖱 Open `/admin`.
  2. 👁 Scan **metric cards** (active participants, total peers, avg RC, referrals).
  3. 👁 Scan **alerts**: overdue check-ins (red), crisis notes (red), pending assessments (amber), pending peer applications (purple), unassigned participants (blue).
  4. 👁 Scan **peer overview** for self-care-overdue indicators.
  5. 🖱 Tap any alert to drill into the relevant page.
- **Result:** You know your top priorities for the day.
- **If something's off:** Loader still spinning past 15s? It auto-times-out per section — refresh once.
- **Linked:** A-1

### T-ADMIN-02 — Assign a peer to an unassigned participant
- **Cadence:** Daily · **Time:** ~2 min each
- **Goal:** Match a participant who has no peer.
- **Where:** `/admin/participants` → **Needs** tab → click row → sheet
- **Steps:**
  1. 🖱 Dashboard alert "Unassigned participants" → tap.
  2. 🖱 Click the participant row → sheet opens.
  3. 🖱 In the **Care Team** tab of the sheet, assign a peer.
- **Result:** 🔔 Participant's Stage 3 banner flips; peer's caseload updates in realtime.
- **Linked:** A-3, A-4

### T-ADMIN-03 — Confirm a pending assessment (when peer hasn't)
- **Cadence:** Daily · **Time:** ~3 min
- **Goal:** Backstop confirmation if the peer is delayed.
- **Where:** Dashboard → "Pending Assessment" widget → participant sheet → **Assessments** tab
- **Steps:**
  1. 🖱 From dashboard widget, click the participant.
  2. 🖱 In sheet, **Assessments** tab → **Confirm Score**.
- **Result:** Same as T-PEER-07 (`assessment.confirmed` fires).
- **Linked:** A-3, A-4

### T-ADMIN-04 — Review the audit log
- **Cadence:** Daily (compliance) · **Time:** ~5 min
- **Goal:** Spot anomalies in actor activity, passport views, or sensitive actions.
- **Where:** `/admin/audit`
- **Steps:**
  1. 🖱 Open `/admin/audit`.
  2. 🖱 Filter by event type, date, or actor.
  3. 🖱 Click an entry → sheet "Audit Entry Details."
- **Result:** You have a documented compliance review for the day.
- **Linked:** A-13

## Weekly

### T-ADMIN-05 — Run the weekly peer specialist productivity report
- **Cadence:** Weekly (Monday) · **Time:** ~5 min
- **Goal:** See each peer's caseload size, compliance %, CRPS progress, last activity.
- **Where:** `/admin` (Peer overview list) AND `/admin/reports` (Workforce section)
- **Steps:**
  1. 🖱 Open `/admin` → scroll to **Peer overview list**.
  2. 👁 Note self-care-overdue indicators.
  3. 🖱 Open `/admin/reports`.
  4. ⌨ Set start date and end date (last 7 days).
  5. 🖱 Generate Report.
  6. 👁 Review the **Workforce** section.
  7. 🖱 (Optional) Export CSV or Print.
- **Result:** You have weekly productivity numbers per peer. 📜 Generation is logged to audit.
- **If something's off:**
  - "Select date range" toast → set both dates first.
  - CSV is empty → no activity in that range; broaden it.
- **Linked:** A-1, A-12

### T-ADMIN-06 — Run the weekly participant outcomes report
- **Cadence:** Weekly · **Time:** ~5 min
- **Goal:** Track participant volume, stabilization, and recovery progress trends.
- **Where:** `/admin/reports`
- **Steps:**
  1. 🖱 Open `/admin/reports`.
  2. ⌨ Set start/end dates and (optional) program/location filter.
  3. 🖱 Generate Report.
  4. 👁 Review **Participant Volume**, **Stabilization**, **Recovery Progress**, **Referrals** sections.
  5. 🖱 (Optional) Export CSV / Print.
- **Linked:** A-12

### T-ADMIN-07 — Process pending peer applications
- **Cadence:** Weekly (or as they come in) · **Time:** ~5 min each
- **Goal:** Approve, reject, or suspend peer specialists.
- **Where:** `/admin/peers` → **Pending** tab
- **Trigger:** Dashboard alert "Pending peer applications."
- **Steps:**
  1. 🖱 Open `/admin/peers` → **Pending** tab.
  2. 🖱 Click a peer → review profile.
  3. 🖱 **Approve** OR **Reject** (dialog "Reject Application" with reason field) OR **Suspend**.
- **Result:** 🔔 Peer is notified (`peer.approved` / `peer.rejected` / `peer.suspended`); their gating screen changes.
- **Linked:** A-5

### T-ADMIN-08 — Review and approve pending peer profile edits
- **Cadence:** Weekly · **Time:** ~3 min each
- **Goal:** Approve bio/specialty changes peers made (`pending_edits` JSONB).
- **Where:** `/admin/peers` → peer with pending edits → **Review Profile Changes** sheet
- **Steps:**
  1. 🖱 Open `/admin/peers`.
  2. 🖱 Click a peer with pending edits → **Review Profile Changes** sheet.
  3. 👁 Read the diff.
  4. 🖱 Approve or reject.
- **Result:** If approved, 🔔 peer notified `peer_edits_approved`; fields go live.
- **Linked:** A-5

### T-ADMIN-09 — Submit supervisor feedback to a peer
- **Cadence:** Weekly · **Time:** ~5 min
- **Goal:** Give structured feedback and credit hours.
- **Where:** `/admin/peers/review`
- **Steps:**
  1. 🖱 Open `/admin/peers/review`.
  2. ⌨ Pick the peer; write feedback; enter hours to credit.
  3. 🖱 Submit.
- **Result:** Toast: *"Feedback sent & hours credited."* 🔔 Peer notified `supervisor_feedback`.
- **Linked:** A-6

### T-ADMIN-10 — Verify CRPS competencies and hours
- **Cadence:** Weekly · **Time:** ~5 min per peer
- **Goal:** Sign off on individual competency milestones and hours batches.
- **Where:** `/admin/peers/:peerId` → **Verify** tab
- **Steps:**
  1. 🖱 Open the peer detail page → **Verify** tab.
  2. 🖱 Tap **Verify Competency** on each completed item → toast *"Competency verified."*
  3. 🖱 Tap **Verify Hours** on logged batches → toast *"Hours verified."*
- **Result:** When eligibility threshold is met, 🔔 peer gets `crps.eligible`.
- **Linked:** A-7

### T-ADMIN-11 — Change a user's role
- **Cadence:** As-needed · **Time:** ~1 min
- **Goal:** Promote/demote a user between participant / peer_specialist / admin.
- **Where:** `/admin/users`
- **Steps:**
  1. 🖱 Open `/admin/users`.
  2. ⌨ Search for the user.
  3. 🖱 Change role → confirm in dialog "Change user role?"
- **If something's off:** Wrong role granted? Repeat to revert.
- **Linked:** A-2

## Periodic — Content Management

### T-ADMIN-12 — Add or edit a Program
- **Cadence:** Periodic · **Time:** ~3 min
- **Where:** `/admin/content/programs`
- **Steps:** 🖱 Add/Edit Program dialog → ⌨ name, type, address → save.
- **Note:** `programs.type` enum: respite_house · sober_living · treatment · outpatient.
- **Linked:** A-8

### T-ADMIN-13 — Add or edit a Milestone definition
- **Cadence:** Periodic · **Time:** ~3 min
- **Where:** `/admin/content/milestones`
- **Steps:** 🖱 Add/Edit/Delete (toasts confirm each).
- **Linked:** A-8

### T-ADMIN-14 — Manage Assessment domains
- **Cadence:** Periodic · **Time:** ~5 min
- **Where:** `/admin/content/assessment`
- **Steps:** 🖱 Add domain · edit score level · deactivate · reactivate (8 toast confirmations).
- **Linked:** A-8

### T-ADMIN-15 — Publish a new program agreement
- **Cadence:** Periodic · **Time:** ~5 min
- **Where:** `/admin/content/agreements`
- **Steps:**
  1. 🖱 Open `/admin/content/agreements`.
  2. ⌨ Compose the new agreement (or version it).
  3. 🖱 Publish.
- **Result:** Toast: *"Agreement published."* 🔔 All participants in that program get `agreement_updated`. Old version is auto-superseded.
- **Linked:** A-8 · `agreement.published`

### T-ADMIN-16 — Add, edit, or approve a community resource
- **Cadence:** Periodic · **Time:** ~3 min
- **Where:** `/admin/content/resources`
- **Steps:** 🖱 Add/Edit/Approve/Remove resource (toasts).
- **Note:** Resources are stored in `community_partners` (NOT resource_listings).
- **Linked:** A-8

### T-ADMIN-17 — Add or edit MI prompts
- **Cadence:** Periodic · **Time:** ~2 min
- **Where:** `/admin/content/mi-prompts`
- **Steps:** 🖱 Add/Edit prompt.
- **Linked:** A-8

### T-ADMIN-18 — Edit Crisis protocol or Note templates
- **Cadence:** Periodic · **Time:** ~5 min
- **Where:** `/admin/content/protocols`
- **Steps:** 🖱 tabs Edit · Preview → dialogs **Edit Crisis Protocol**, **Version preview**, **Edit Note Template**.
- **Linked:** A-8

### T-ADMIN-19 — Manage Plan templates
- **Cadence:** Periodic · **Time:** ~10 min
- **Where:** `/admin/content/plan-templates`
- **Steps:** 🖱 Add/Edit Step · **Duplicate All 4 Phases** · Preview phase.
- **Linked:** A-8

## Periodic — Per-Participant Admin Actions

### T-ADMIN-20 — Log a payment for a participant
- **Cadence:** As-needed · **Time:** ~1 min
- **Where:** `/admin/participants/:id/payments`
- **Steps:** 🖱 Log entry → toast *"Entry logged."*
- **Result:** 🔔 Participant sees it on `/payments`.
- **Linked:** A-10 · `payment.recorded`

### T-ADMIN-21 — Review a participant's check-ins (read-only)
- **Cadence:** As-needed · **Time:** ~2 min
- **Where:** `/admin/participants/:id/checkins`
- **Linked:** A-9

### T-ADMIN-22 — Review a participant's notes feed (incl. crisis flags)
- **Cadence:** As-needed (urgent if crisis alert) · **Time:** ~3 min
- **Where:** `/admin/participants/:id/notes`
- **Trigger:** Dashboard crisis-note alert.
- **Steps:** 🖱 Navigate → 👁 read feed; click flagged crisis notes first.
- **Linked:** A-11

### T-ADMIN-23 — Update your admin profile
- **Cadence:** As-needed · **Time:** ~1 min
- **Where:** `/admin/profile`
- **Steps:** ⌨ name / photo → save.
- **Linked:** A-14

### T-ADMIN-24 — Seed or clear demo data
- **Cadence:** One-time / training only · **Time:** ~1 min
- **Where:** `/admin` → **Demo Controls**
- **Steps:** 🖱 Seed → demo data populates. 🖱 Clear → AlertDialog *"Clear all demo data?"* → confirm.
- **⚠ Warning:** Clear is destructive. Only use in training environments.
- **Linked:** A-1 (DemoControls)

---

# 4. Cross-Role Tasks (anyone)

### T-ANY-01 — Read and act on notifications
- **Cadence:** Daily · **Time:** ~1 min
- **Where:** Bell icon (header) or `/notifications`
- **Steps:**
  1. 🖱 Tap bell → see latest.
  2. 🖱 Tap a row → deep-links + marks read.
  3. 🖱 Or use **Mark all read** on `/notifications`.
- **Linked:** G-6, G-7

### T-ANY-02 — Recover from offline
- **Cadence:** As-needed · **Time:** N/A
- **Where:** Anywhere — Offline banner appears when `navigator.onLine === false`.
- **Steps:**
  1. 👁 See banner.
  2. 🛑 Pause writes (forms may fail with toast).
  3. 👁 Wait for banner to clear.
- **Linked:** G-8

### T-ANY-03 — Install the app to your home screen (PWA)
- **Cadence:** One-time · **Time:** ~30 sec
- **Where:** Mobile → InstallPrompt
- **Steps:** 🖱 Tap **Install** when the prompt appears.
- **Linked:** G-8

### T-ANY-04 — Use a public passport link (no account needed)
- **Cadence:** As-shared (external recipients) · **Time:** ~1 min
- **Where:** `/passport/:token` (link given to you)
- **Steps:**
  1. 🖱 Open the link.
  2. 👁 Read the **42 CFR redisclosure notice** at the top.
  3. 👁 View the read-only card.
- **Result:** 📜 Every view is logged to `audit_log` via `log_passport_view()` RPC.
- **If something's off:** "Link expired" or "revoked" → ask the participant for a new one.
- **Linked:** G-5

---

# 5. Reconciliation — Inventory Coverage

This table verifies every inventory row from `training-coverage-inventory.md` is touched by at least one task above.

| Inventory row | Surface | Covered by |
|---|---|---|
| G-1 | Landing | (passive — implicit before Login) |
| G-2 | Auth (login/signup/reset) | Implicit before all role tasks; documented as prereq |
| G-3 | Intake `/intake` | T-PART (implicit pre-account; intake handled outside playbook scope) |
| G-4 | Profile setup | Implicit prereq of T-PART-01 / T-PEER-01 |
| G-5 | Public passport `/passport/:token` | T-ANY-04 |
| G-6 | `/notifications` | T-ANY-01, T-PART-15 |
| G-7 | NotificationBell | T-ANY-01 |
| G-8 | Offline banner / Install prompt | T-ANY-02, T-ANY-03 |
| G-9 | 404 | (passive — no task) |
| P-1 | `/card` | T-PART-01, T-PART-02, T-PART-03 |
| P-2 | `/milestones` | (linked from card; covered indirectly via T-PART-01 — see gap below) |
| P-3 | `/assessment/take` | T-PART-04 |
| P-4 | `/assessment/history` | T-PART-05 |
| P-5 | `/plan` | T-PART-06 |
| P-6 | `/resources` | T-PART-11, T-PART-12 |
| P-7 | `/resources/:id` | T-PART-11 |
| P-8 | `/passport` | T-PART-10 |
| P-9 | `/profile` | T-PART-13 |
| P-10 | `/peers/browse` | T-PART-09 |
| P-11 | `/checkins` | T-PART-07 |
| P-12 | `/agreements` | T-PART-08 |
| P-13 | `/payments` | T-PART-14 |
| PS-1 | Holding/Rejected/Suspended | (implicit — peer can't do tasks until approved) |
| PS-2 | `/caseload` | T-PEER-01, T-PEER-02 |
| PS-3 | `/caseload/:id` | T-PEER-03, T-PEER-05, T-PEER-06, T-PEER-07, T-PEER-08, T-PEER-09, T-PEER-10, T-PEER-11 |
| PS-4 | legacy detail | T-PEER-17 |
| PS-5 | check-in form | T-PEER-04 |
| PS-6 | LogCheckInSheet | T-PEER-04 |
| PS-7 | Tabs (Assessments/Milestones/CheckIns/Notes/Plan/Transitions) | T-PEER-05, T-PEER-06, T-PEER-07, T-PEER-08, T-PEER-09, T-PEER-10, T-PEER-11 |
| PS-8 | `/crps` | T-PEER-13 |
| PS-9 | `/crps/selfcare` | T-PEER-12 |
| PS-10 | `/peers/profile` | T-PEER-15 |
| PS-11 | `/peer/checkins` | T-PEER-14 |
| A-1 | `/admin` dashboard | T-ADMIN-01, T-ADMIN-05, T-ADMIN-24 |
| A-2 | `/admin/users` | T-ADMIN-11 |
| A-3 | `/admin/participants` | T-ADMIN-02, T-ADMIN-03 |
| A-4 | AdminParticipantDetailSheet | T-ADMIN-02, T-ADMIN-03 |
| A-5 | `/admin/peers` | T-ADMIN-07, T-ADMIN-08 |
| A-6 | `/admin/peers/review` | T-ADMIN-09 |
| A-7 | `/admin/peers/:id` | T-ADMIN-10 |
| A-8 | `/admin/content/*` | T-ADMIN-12 → T-ADMIN-19 |
| A-9 | `/admin/participants/:id/checkins` | T-ADMIN-21 |
| A-10 | `/admin/participants/:id/payments` | T-ADMIN-20 |
| A-11 | `/admin/participants/:id/notes` | T-ADMIN-22 |
| A-12 | `/admin/reports` | T-ADMIN-05, T-ADMIN-06 |
| A-13 | `/admin/audit` | T-ADMIN-04 |
| A-14 | `/admin/profile` | T-ADMIN-23 |

## Known gaps (rows touched only indirectly — flagged for Phase 5 expansion)

- **P-2 `/milestones`** — currently only reached via the Card. Consider adding a dedicated participant task: *"View your milestones page"* (T-PART-XX) if the Card preview is insufficient.
- **G-3 Intake `/intake`** — handled outside the in-app playbook because it happens pre-account. May warrant a separate "Intake staff" or "First-day onboarding" mini-playbook.
- **PS-1 holding screens** — passive; if peers in pending/rejected/suspended states need guidance, add a "What to do while pending approval" task.
- **G-9 404** — purely defensive UX; no task needed.

These are documented gaps, not omissions hidden by recall. They are the agenda for Phase 5.

---

## Change log

- 2026-04-24 — Initial Task Playbook created (Phase 3.5). Renamed prior `training-workflow-map.md` → `system-event-map.md` to clarify trigger-oriented vs task-oriented separation.
