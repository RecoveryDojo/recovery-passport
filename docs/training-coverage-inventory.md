# Training Coverage Inventory

> **Source of truth** for every user-facing capability in Recovery Passport. Built from
> `src/App.tsx` route table, every page component, every tab/sheet/dialog inside those
> pages, and the cross-role event contract in `docs/interdependency-map.md`.
>
> **Rule:** every row here MUST appear in at least one training document
> (quick-start, full reference, or workflow manual). If a row is unmapped, training is
> incomplete — see `docs/training-coverage-matrix.md` for the gating checklist.

Roles: **P** = Participant · **PS** = Peer Specialist · **A** = Admin · **G** = Global/Public

Legend per inventory row:
- **Surface** = route + visible section/tab/sheet/dialog
- **Primary actions** = main buttons / form submits
- **Secondary actions** = link-outs, toggles, exports, deletes
- **Triggers** = automatic notifications, alerts, toasts, level-ups
- **States** = empty / loading / error / pending / approved / overdue / expired / revoked / first-use
- **Cross-role handoffs** = which other role gets a signal (see `docs/interdependency-map.md`)

---

## 0. Global / Shared (G)

### G-1. Landing page — `/` and `/home` (`LandingPage.tsx`)
- **Surface:** marketing landing
- **Primary actions:** Login, Signup, Intake (participant)
- **Secondary actions:** Custom domain awareness (myrecoverypassport.com)
- **States:** unauthenticated default; auto-redirects authenticated users to role home
- **Handoffs:** none

### G-2. Auth — `/login`, `/signup`, `/forgot-password`, `/reset-password`
- **Primary actions:** sign in, sign up (passes `role` in `options.data`), request password reset, set new password
- **Triggers:** signup auto-creates `users` row + skeleton profile via DB trigger
- **States:** invalid creds, email-not-confirmed, reset-link-sent, link-expired
- **Handoffs:** PS signup creates pending peer; A is notified via approval queue

### G-3. Intake — `/intake` (`IntakePage.tsx`)
- **Surface:** 3-step wizard (Account → About You → Recovery)
- **Primary actions:** Next, Back, Submit (creates auth user + participant_profiles)
- **Secondary actions:** add custom substance, choose program, choose recovery pathway
- **Triggers:** "Intake complete!" toast; emits `Completed Intake` milestone-eligible state
- **States:** validation gates per step; complete screen with link to `/card`
- **Handoffs:** A dashboard sees new participant in `unassigned_participants` alert

### G-4. Profile setup
- `/profile/setup` — `ProfileSetup.tsx` (P only) → "Profile created!" toast → `/card`
- `/peers/setup` — `PeerProfileSetup.tsx` (PS only) → "Profile submitted! pending approval" → holding screen
- **Validation:** photo ≤ 5 MB; first/last name required
- **Handoffs:** PS setup INSERT auto-seeds 12 CRPS competency milestones

### G-5. Public passport — `/passport/:token` (`PublicPassportPage.tsx`)
- **Surface:** unauthenticated read-only card view
- **Data path:** `get_shared_link_by_token()` RPC + `log_passport_view()` RPC
- **States:** valid · expired · revoked · invalid token · 42 CFR redisclosure notice
- **Handoffs:** every view writes audit_log entry visible on `/admin/audit`

### G-6. Notifications — `/notifications` (`NotificationsPage.tsx`)
- **Roles:** P, PS, A
- **Primary actions:** mark single read, mark-all-read, click row → deep link
- **Triggers (all `notification_type` values):** `level_up`, `milestone_unlocked`, `peer_request_received/approved/declined/cancelled`, `new_participant`, `assessment_ready_for_review`, `supervisor_feedback`, `peer_application_approved/rejected`, `peer_edits_approved`, `agreement_updated`, `referral_received`, `crps_eligible`, `general` (low-mood, crisis-note, self-care)
- **States:** unread badge in `NotificationBell`; empty state when no notifications

### G-7. Notification bell (`NotificationBell.tsx`) — sticky header on every layout
- **Surface:** dropdown of latest N notifications
- **Actions:** click → mark read + navigate; "See all" → `/notifications`
- **Triggers:** unread count badge

### G-8. Offline banner + Install prompt
- `OfflineBanner.tsx` — shown when `navigator.onLine === false`; banner persists until reconnect
- `InstallPrompt.tsx` — A2HS prompt for PWA install (mobile)

### G-9. 404 — `/*` `NotFound.tsx`

---

## 1. Participant (P)

### P-1. `/card` — Baseball Card Home (`CardPage.tsx`)
- **Sections:**
  - Card header (level badge: ROOKIE / STARTER / VETERAN / ALL-STAR; level-up celebration toast)
  - Today section (`TodaySection.tsx`)
  - Streak stats (`StreakStats.tsx`)
  - RC sparkline + per-domain breakdown (`RcSparkline.tsx`) — confirmed vs unconfirmed pill
  - Today focus card (`TodayFocusCard.tsx`)
  - Mood widget (`MoodWidget.tsx`) — toast "Mood logged 💛"
  - Reflection journal (`ReflectionJournal.tsx`) — toast "Saved to your journal" / error
  - Resource of the day (`ResourceOfTheDay.tsx`)
  - Next milestone preview (`NextMilestonePreview.tsx`)
  - Ask Your Peer card (`AskYourPeerCard.tsx`) — toast "Sent to your peer"
  - Stage 3 banner — flips after `peer_request.responded`
  - Quick action FAB (`QuickActionFab.tsx`) — sheet "Quick mood check"
  - Level roadmap modal (`LevelRoadmapModal.tsx`) — dialog "Your Roadmap"
- **Realtime:** `card-level-${id}`, `milestones-${id}`, `assessments-${id}`
- **Triggers:** level-up toast (5s) + `level_up` event emit; "Nice work — one step closer 👏" on focus complete
- **States:** no peer assigned (Stage 3 banner CTA → `/peers/browse`); no assessments yet (RC sparkline placeholder); first-day-of-recovery; 30/60/90-day milestone proximity

### P-2. `/milestones` — `ParticipantMilestonesPage.tsx`
- **Sections:** unlocked milestones list, locked milestones with criteria
- **States:** empty; recently unlocked highlight

### P-3. `/assessment/take` — `AssessmentTakePage.tsx`
- **Primary action:** submit (toast "Assessment submitted!") → `assessment_sessions` insert + `assessment_scores`
- **Triggers:** `assessment.completed` → PS notification `assessment_ready_for_review`; if first ever → `generate_recovery_plan` RPC fires server-side
- **States:** in-progress per-domain; review screen; submitted

### P-4. `/assessment/history` — `AssessmentHistoryPage.tsx`
- **Sections:** timeline of all sessions; per-session score detail
- **States:** confirmed vs unconfirmed; empty

### P-5. `/plan` — `PlanPage.tsx`
- **Sections:** 4 phases (30/60/90/six_month), step list per active phase
- **Primary actions:** check/uncheck step (optimistic) → `plan_step.completed`
- **Triggers:** phase auto-advances on completion ratio → `phase.advanced`
- **States:** no plan yet (pre-first-assessment empty); phase locked; phase active; phase complete

### P-6. `/resources` — `ResourceDirectoryPage.tsx`
- **Sections:** category filters (employment, food, legal, medical, mental_health…)
- **Primary actions:** view detail, "Request Next Placement" dialog → notifies assigned peer
- **Toasts:** "Failed to send request" on error
- **States:** no peer assigned (CTA disabled); empty results

### P-7. `/resources/:resourceId` — `ResourceDetailPage.tsx`
- **Sections:** description, contact, hours, partner type
- **Actions:** call, directions, share

### P-8. `/passport` — `PassportConfigPage.tsx`
- **Sections:** recipient field, purpose, section toggles (7 sections; payment_history locked OFF), expiry select (24h/7d/30d/none), 42 CFR consent acknowledgment checkbox
- **Primary actions:** Generate link → toast "Passport link generated"
- **Secondary actions:** Copy URL ("Copied to clipboard"), Share, Download QR, Revoke (alert dialog "Revoke this link?") → toast "Link revoked"
- **States:** ack-required, generated, expired, revoked, no-link-yet
- **Handoffs:** writes `consent_records` + `shared_links`; A audit visible on `/admin/audit`

### P-9. `/profile` — `Profile.tsx`
- **Primary actions:** edit name, photo upload (5 MB cap), save
- **Toasts:** "Photo updated", "Profile updated", "Account deletion coming soon"
- **States:** photo-too-large, missing-name validation

### P-10. `/peers/browse` — `PeerBrowsePage.tsx`  (alias: `/peer-browser`)
- **Sections:** current assigned peer card; available approved peers list
- **Primary actions:** Request, Switch (alert dialog "Switch request?"), Cancel (toast "Request cancelled.")
- **States:** no pending request · pending request · already assigned · switching

### P-11. `/checkins` — `ParticipantCheckInsPage.tsx`
- **Sections:** read-only history of `weekly_checkins` logged by peer
- **States:** empty (no peer activity yet)

### P-12. `/agreements` — `ParticipantAgreementsPage.tsx`
- **Sections:** agreements list per program
- **Primary actions:** Acknowledge (toast "Agreement acknowledged")
- **Triggers:** `agreement.acknowledged` → A compliance log
- **States:** new (`agreement_updated` notification), acknowledged, version-superseded

### P-13. `/payments` — `ParticipantPaymentsPage.tsx`
- **Sections:** ledger of `payment_records`
- **States:** empty

---

## 2. Peer Specialist (PS)

### PS-1. Holding/Rejection/Suspended screens (`PeerPendingApproval.tsx`)
- Shown via `ProtectedRoute` when `approval_status` ≠ approved
- Variants: pending · rejected (with reason) · suspended

### PS-2. `/caseload` — `CaseloadPage.tsx`
- **Sections:**
  - `CaseloadHealthHeader` — workload + self-care prompt
  - Pending Requests list — Approve / Decline buttons → toasts "Request approved" / "Request declined"
  - Caseload list (`CaseloadParticipantCard.tsx`) — name, level, last contact, RC pill, crisis dot (14-day window), engagement pill
- **Realtime:** `caseload-${peerUserId}`, `peer-requests-${peerUserId}`, `feedback-${peerUserId}`
- **States:** no requests, no caseload, fully overdue caseload

### PS-3. `/caseload/:participantId` — `CaseloadParticipantDetailPage.tsx`
- **Tabs:** overview, journey, engagement, care-team, notes
- **Per tab signals:** see `docs/role-surface-matrix.md` (PS section)
- **Quick actions menu** (`QuickActionsMenu.tsx`): Log check-in (sheet), Add note, Unlock milestone, Confirm assessment, Start referral

### PS-4. `/caseload/:participantId/legacy` — `ParticipantDetailPage.tsx`
- Tabs: milestones, assessments, plan, checkins, payments, notes, transitions

### PS-5. `/caseload/:participantId/checkin` and `/checkin/:participantId` — `CheckInFormPage.tsx`
- **Primary action:** save check-in → toast "Check-in saved"
- **Validation:** "Please complete all required fields"
- **Triggers:** `checkin.logged` + `log_checkin_crps_hours` RPC; if `mood_status ≤ 2` → `checkin.low_mood` → A notification

### PS-6. `LogCheckInSheet.tsx` (used inside caseload row quick action)
- Sheet "Log Check-In"; required fields validation toast

### PS-7. Tabs (shared between PS and A sheet)
- **AssessmentsTab.tsx** — Confirm score → toast "Assessment confirmed!" → `assessment.confirmed`
- **MilestonesTab.tsx** — dialog "Unlock: {name}" → calls `recalculate_card_level` RPC → `milestone.unlocked`
- **CheckInsTab.tsx** — 8-week strip + log button
- **NotesTab.tsx** — dialog "New Progress Note"; types: general / milestone / referral / transition / **crisis** (toast: "Note flagged for supervisor review. Remember to complete your self-care check.")
- **PeerPlanTab.tsx** — add/edit/remove step (toasts), Manual unlock phase (alert dialog "Unlock {phase} phase?")
- **TransitionsTab.tsx** — Start Referral dialog, Discharge Summary dialog; toasts: "Referral created", "Signed off", "Marked as completed"

### PS-8. `/crps` — `CrpsPage.tsx`
- **Sections:** 6 tools + 6 skills competencies, hours log, eligibility status
- **Primary actions:** dialog "Log Manual Hours" → toast "Hours logged"
- **States:** not_started · in_progress · verified · eligible

### PS-9. `/crps/selfcare` — `SelfCarePage.tsx`
- **Primary action:** submit mood/energy/stress + notes → toast "Self-care check completed"
- **Triggers:** `is_flagged = true` when stress≥4 OR mood≤2 → A widget alert
- **States:** overdue (no submit in 7d) — derived signal on A dashboard

### PS-10. `/peers/profile` — `PeerProfile.tsx`
- **Primary actions:** edit bio/specialties/photo → "Profile updated. Bio/specialty changes are pending admin review." (writes to `pending_edits` JSONB)
- **States:** approved · pending edits · suspended

### PS-11. `/peer/checkins` — `PeerCheckInsPage.tsx`
- Aggregated check-ins logged by this peer

---

## 3. Admin (A)

### A-1. `/admin` — `AdminDashboardPage.tsx`
- **Metric cards:** total active, total peers, avg RC, referrals
- **Alert items:** overdue check-ins (red), crisis notes (red), pending assessments (amber), pending peer applications (purple), unassigned participants (blue)
- **Peer overview list:** caseload count, compliance %, CRPS progress, last activity, **self-care overdue indicator**
- **Program summary list:** active count, avg RC, milestone rate
- **Safety:** 15-second loader timeout; per-loader try/catch isolation
- **DemoControls:** seed/clear demo data (`AlertDialog "Clear all demo data?"`)

### A-2. `/admin/users` — `AdminUsersPage.tsx`
- **Primary actions:** search, change role (`AlertDialog "Change user role?"`)
- **States:** existing roles: participant / peer_specialist / admin

### A-3. `/admin/participants` — `AdminParticipantsPage.tsx`
- **Tabs:** needs · all
- **Sections:** Pending Assessment widget, Unassigned widget, list
- **Click row →** `AdminParticipantDetailSheet`

### A-4. `AdminParticipantDetailSheet.tsx` (modal sheet)
- **Tabs:** overview · journey · engagement · care-team · notes
- **Actions:** assign peer (`participant.assigned_peer`), confirm assessment, view supervisor feedback, add supervisor feedback (`supervisor_feedback.created` → PS notification)

### A-5. `/admin/peers` — `AdminPeersPage.tsx`
- **Tabs:** all · pending · approved · suspended
- **Primary actions:** approve, reject (`Dialog "Reject Application"` with reason), suspend, view profile changes (`Sheet "Review Profile Changes"`), `Sheet "Profile Review"`
- **Triggers:** `peer.approved/rejected/suspended/edits_approved` → PS notifications

### A-6. `/admin/peers/review` — `AdminPeerReviewPage.tsx`
- **Primary action:** submit feedback + credit hours → toast "Feedback sent & hours credited"

### A-7. `/admin/peers/:peerId` — `AdminPeerDetailPage.tsx`
- **Tabs:** progress · verify
- **Actions:** verify competency (toast "Competency verified"), verify hours (toast "Hours verified")
- **Triggers:** if threshold met → `crps.eligible` → PS notification

### A-8. `/admin/content` and sub-routes
- `/admin/content` — content hub
- `/admin/content/programs` — `AdminProgramsPage.tsx` — Add/Edit Program dialog
- `/admin/content/milestones` — `AdminMilestonesPage.tsx` — Add/Edit/Delete (toasts)
- `/admin/content/assessment` — `AdminAssessmentDomainsPage.tsx` — Add domain, edit score level, deactivate / reactivate, add (8 toasts)
- `/admin/content/agreements` — `AdminAgreementsPage.tsx` — Publish (toast "Agreement published"; notifies all participants in program; `agreement.published` event)
- `/admin/content/resources` — `AdminResourcesPage.tsx` — Add/Edit/Approve/Remove resource (toasts)
- `/admin/content/mi-prompts` — `AdminMiPromptsPage.tsx` — Add/Edit prompt
- `/admin/content/protocols` — `AdminProtocolsPage.tsx` — tabs edit · preview; dialogs: Edit Crisis Protocol, Version preview, Edit Note Template
- `/admin/content/plan-templates` — `AdminPlanTemplatesPage.tsx` — Add/Edit Step, Duplicate All 4 Phases, Preview phase

### A-9. `/admin/participants/:id/checkins` — `AdminParticipantCheckInsPage.tsx`
- Read-only history per participant

### A-10. `/admin/participants/:id/payments` — `AdminPaymentsPage.tsx`
- **Primary action:** log payment entry → toast "Entry logged" → P sees on `/payments`

### A-11. `/admin/participants/:id/notes` — `AdminParticipantNotesPage.tsx`
- Read-only notes feed (incl. crisis flags)

### A-12. `/admin/reports` — `AdminReportsPage.tsx`
- **Filters:** start date, end date (Calendar), program/location filter
- **Primary action:** Generate Report (validation toast "Select date range")
- **Sections:** Participant Volume · Stabilization · Recovery Progress · Workforce · Referrals
- **Secondary actions:** CSV export, Print
- **Audit:** report generation writes to `audit_log`

### A-13. `/admin/audit` — `AdminAuditPage.tsx`
- **Sections:** filterable audit_log feed; sheet "Audit Entry Details"
- **States:** filter by event type, date, actor

### A-14. `/admin/profile` — `AdminProfilePage.tsx`
- Edit own admin name/photo

---

## 4. Cross-role handoff index (must be in every reference manual)

(Single source: `docs/interdependency-map.md`. Reproduced here as a checklist gate.)

| Source action | Source surface | Receiver | Receiver surface |
|---|---|---|---|
| Assessment submitted | P `/assessment/take` | PS, A | PS caseload card RC pill; A "Pending Assessment" widget |
| Assessment confirmed | PS/A confirm | P | `/card` RC pill flips to "confirmed" |
| Peer request | P `/peers/browse` | PS, A | PS `/caseload` Pending Requests; A dashboard alert |
| Peer request approved | PS `/caseload` | P, A | P Stage 3 banner flips; A unassigned recount |
| Plan step completed | P `/plan` | PS, A | journey progress refresh |
| Phase advanced | P `/plan` | PS, A | "Phase advanced" line |
| Consent + shared link | P `/passport` | A | `/admin/audit` compliance log |
| Agreement acknowledged | P `/agreements` | A | sheet Notes compliance line |
| Check-in logged | PS check-in form / sheet | P, A | P "Last contact"; A engagement pill recalc |
| Low-mood check-in | PS, mood ≤ 2 | A | notification + Overview risk flag |
| Note created (any) | PS NotesTab | A | sheet Notes feed |
| Note crisis | PS, type=crisis | A, PS | A red alert; PS caseload card crisis dot 14d |
| Milestone unlocked | PS MilestonesTab | P, A | P celebration toast; A journey |
| Level up | derived | P | toast + bell + notifications page |
| Referral created | PS TransitionsTab | P, A | P `/resources` highlight; A compliance |
| Self-care flagged | PS `/crps/selfcare` | A | dashboard widget |
| Self-care overdue | derived (no submit 7d) | A | dashboard indicator |
| Peer approved/rejected/suspended | A `/admin/peers` | PS | gating screen change |
| Peer edits approved | A `/admin/peers/:id` | PS | profile fields go live |
| Participant assigned peer | A sheet | P, PS | P Stage 3 banner; PS caseload row appears |
| Supervisor feedback | A sheet Care Team | PS | bell + Care Team badge |
| Payment recorded | A `/admin/payments` | P | `/payments` ledger |
| Agreement published | A `/admin/agreements` | P | `/agreements` "New" badge |
| CRPS eligible | A `/admin/peers/:id` | PS | `/crps` page |

---

## 5. State catalog (must be represented in training)

For every applicable surface above, training must show at least one of each state where it applies:

- **First-use / empty** — no plan yet · no assessments yet · no peer assigned · no caseload · no notifications · no payments
- **Loading** — query in flight; dashboard 15-second safety timeout
- **Pending** — peer application pending · peer profile edits pending · peer request pending · assessment pending review · agreement unread
- **Approved / Confirmed** — peer approved · assessment confirmed · agreement acknowledged · resource approved
- **Rejected / Declined / Suspended** — peer rejected · peer suspended · peer request declined
- **Overdue / Flagged** — overdue check-in · self-care overdue · crisis note (14d window) · low-mood flag
- **Expired / Revoked** — passport link expired · passport link revoked · agreement version superseded
- **Validation / Error** — required-field toast · photo > 5 MB · invalid date range · "Failed to …" mutation errors
- **Offline** — `OfflineBanner` visible

---

## 6. Action catalog (must be represented in training)

- **Buttons / quick actions:** every Primary/Secondary action in §1–3 above
- **Form submissions:** intake wizard, profile edits, assessment submit, check-in form, note dialog, plan step toggle, agreement acknowledge, passport generate, payment entry, hours log, self-care submit, all admin content CRUD
- **Exports / downloads / print:** Reports CSV export, Reports Print, Passport QR download
- **Approval / review steps:** peer approve/reject/suspend, peer edits review, peer request approve/decline, assessment confirm, hours verify, competency verify, supervisor feedback, agreement publish, resource approve

---

## 7. Workflow catalog (must each be a manual section)

1. Onboarding (Intake → Profile setup → first card view)
2. Peer request / approval (P browse → PS approve → P Stage 3 flip)
3. Assessment cycle (P take → PS/A confirm → plan generated)
4. Plan generation & progression (auto plan → step check → phase advance)
5. Weekly check-in cycle (PS log → CRPS hours credit → P sees last contact)
6. Notes & crisis handling (general/milestone/referral/transition/crisis flow)
7. Milestone unlock & level-up (PS unlock → recalc → P celebration)
8. Referrals & resources (PS referral → P highlight → discharge sign-off)
9. Agreements & compliance (A publish → P acknowledge → audit log)
10. Passport sharing (P configure → consent → share/QR → revoke / expire)
11. Payments (A log → P ledger)
12. Reports (A select range → generate → export/print → audit)
13. Notifications (cross-role bell + page + mark-read flows)
14. Peer wellness & CRPS (self-care submit → flagged → A awareness · hours log → A verify → eligible)
15. Admin oversight (dashboard alerts triage → drill-in → action)
16. Public passport view (anonymous viewer flow + audit footprint)

---

## 8. Coverage discipline

Every row in §0–4 must map to at least one document section in:
- `docs/training-quickstart-{role}.md` — high-frequency rows only
- `docs/training-reference-{role}.md` — every row
- `docs/training-workflow-*.md` — every workflow in §7

Use `docs/training-coverage-matrix.md` as the gating spreadsheet before any PDF export.
