# Training Coverage Matrix

> Gating checklist. Every box must be ticked before any training PDF is exported.
> Pair with `docs/training-coverage-inventory.md` (the row source) and
> `docs/interdependency-map.md` (the cross-role contract).

Status legend: `[ ]` not yet covered · `[~]` partial · `[x]` fully covered (quick-start + reference + workflow as applicable)

---

## Layer 1 — Surface coverage

### Routes (from `src/App.tsx`)

#### Public / Global
- [ ] `/` LandingPage
- [ ] `/login`, `/signup`, `/forgot-password`, `/reset-password`
- [ ] `/intake` IntakePage (3 steps)
- [ ] `/profile/setup` ProfileSetup (P)
- [ ] `/peers/setup` PeerProfileSetup (PS)
- [ ] `/passport/:token` PublicPassportPage (anon)
- [ ] `/notifications` NotificationsPage (P/PS/A)
- [ ] `/*` NotFound

#### Participant
- [ ] `/card` · [ ] `/milestones` · [ ] `/assessment/take` · [ ] `/assessment/history`
- [ ] `/plan` · [ ] `/resources` · [ ] `/resources/:id` · [ ] `/passport`
- [ ] `/profile` · [ ] `/peers/browse` (alias `/peer-browser`)
- [ ] `/checkins` · [ ] `/agreements` · [ ] `/payments`

#### Peer Specialist
- [ ] `/caseload` · [ ] `/caseload/:id` · [ ] `/caseload/:id/legacy`
- [ ] `/caseload/:id/checkin` · [ ] `/checkin/:id`
- [ ] `/crps` · [ ] `/crps/selfcare`
- [ ] `/peers/profile` · [ ] `/peer/checkins`

#### Admin
- [ ] `/admin` Dashboard · [ ] `/admin/users`
- [ ] `/admin/participants` · [ ] `/admin/participants/:id/checkins` · [ ] `/admin/participants/:id/payments` · [ ] `/admin/participants/:id/notes`
- [ ] `/admin/peers` · [ ] `/admin/peers/review` · [ ] `/admin/peers/:id`
- [ ] `/admin/content` · [ ] `/admin/content/programs` · [ ] `/admin/content/milestones` · [ ] `/admin/content/assessment` · [ ] `/admin/content/agreements` · [ ] `/admin/content/resources` · [ ] `/admin/content/mi-prompts` · [ ] `/admin/content/protocols` · [ ] `/admin/content/plan-templates`
- [ ] `/admin/reports` · [ ] `/admin/audit` · [ ] `/admin/profile`

### Tabs (must each be documented as a discrete section)
- [ ] Caseload detail: overview · journey · engagement · care-team · notes
- [ ] Admin participant sheet: overview · journey · engagement · care-team · notes
- [ ] Admin peers: all · pending · approved · suspended
- [ ] Admin participants: needs · all
- [ ] Admin peer detail: progress · verify
- [ ] Admin protocols: edit · preview
- [ ] Legacy participant detail: milestones · assessments · plan · checkins · payments · notes · transitions

### Sheets / Modals / Dialogs
- [ ] Audit Entry Details (sheet)
- [ ] Review Profile Changes / Profile Review (sheets)
- [ ] Reject Application (dialog)
- [ ] Add/Edit Milestone, Domain, Resource, Program, MI Prompt, Plan Step, Note Template, Crisis Protocol (dialogs)
- [ ] Duplicate All 4 Phases, Preview Phase, Version preview (dialogs)
- [ ] Change User Role (alert dialog)
- [ ] Clear All Demo Data (alert dialog)
- [ ] Revoke Passport Link (alert dialog)
- [ ] Switch Peer Request (alert dialog)
- [ ] Unlock Milestone (dialog)
- [ ] New Progress Note (dialog)
- [ ] Remove Step / Unlock Phase (alert dialogs)
- [ ] Start Referral / Discharge Summary (dialogs)
- [ ] Log Manual Hours (dialog)
- [ ] Log Check-In (sheet)
- [ ] Quick Mood Check (sheet)
- [ ] Level Roadmap (dialog)
- [ ] Request Next Placement (dialog)
- [ ] AdminParticipantDetailSheet (master sheet)

### Major widgets / cards
- [ ] CardPage: TodaySection, StreakStats, RcSparkline, TodayFocusCard, MoodWidget, ReflectionJournal, ResourceOfTheDay, NextMilestonePreview, AskYourPeerCard, QuickActionFab, LevelRoadmapModal, Stage 3 banner
- [ ] CaseloadPage: CaseloadHealthHeader, Pending Requests, CaseloadParticipantCard
- [ ] AdminDashboard: 4 metric cards, 5 alert types, peer overview row, program summary row
- [ ] NotificationBell, OfflineBanner, InstallPrompt, DevRoleSwitcher

---

## Layer 2 — Action coverage

### Buttons / quick actions
- [ ] All `Approve / Decline / Reject / Suspend / Verify / Confirm / Acknowledge / Publish / Generate / Revoke / Cancel / Save / Submit / Add / Edit / Delete / Duplicate / Preview / Mark read / Mark all read / Copy / Share / Download` buttons enumerated in inventory §1–3

### Exports / downloads / print
- [ ] Reports → CSV export
- [ ] Reports → Print
- [ ] Passport → QR download
- [ ] Passport → Copy URL / Share

### Form submissions (each with validation states)
- [ ] Intake (3 steps), Profile, PeerProfile, ProfileSetup, PeerProfileSetup
- [ ] AssessmentTake, CheckInForm, LogCheckInSheet, NotesTab, PeerPlanTab steps
- [ ] PassportConfig generate, AdminPayments log, AdminAgreements publish, AdminResources add/edit
- [ ] CrpsPage manual hours log, SelfCarePage submit
- [ ] AdminMilestones, AdminAssessmentDomains, AdminPrograms, AdminMiPrompts, AdminProtocols, AdminPlanTemplates, AdminUsers role-change

### Approval / review chains
- [ ] Peer application: signup → admin approve/reject → PS gating screen
- [ ] Peer profile edits: PS save → `pending_edits` → admin approve → live
- [ ] Peer request: P send → PS approve/decline → P banner flip
- [ ] Assessment: P submit → PS/A confirm → P RC pill flip
- [ ] CRPS hours: PS log → A verify → eligible

---

## Layer 3 — Workflow coverage (§7 of inventory)

- [ ] Onboarding
- [ ] Peer request / approval
- [ ] Assessment cycle
- [ ] Plan generation & progression
- [ ] Weekly check-in cycle
- [ ] Notes & crisis handling
- [ ] Milestone unlock & level-up
- [ ] Referrals & resources
- [ ] Agreements & compliance
- [ ] Passport sharing (incl. revoke + expire + public viewer)
- [ ] Payments
- [ ] Reports
- [ ] Notifications cross-role
- [ ] Peer wellness & CRPS
- [ ] Admin oversight (dashboard triage)
- [ ] Public passport view

---

## Layer 4 — State coverage

For every workflow above, confirm at least one screen for each applicable state:

- [ ] First-use / empty
- [ ] Loading (incl. dashboard 15s safety)
- [ ] Pending (peer app · peer edits · peer request · assessment review · agreement unread)
- [ ] Approved / confirmed
- [ ] Rejected / declined / suspended
- [ ] Overdue / flagged (check-in · self-care · crisis 14d · low-mood)
- [ ] Expired / revoked (passport)
- [ ] Validation / error (each toast string from inventory)
- [ ] Offline

---

## Cross-role handoff coverage

Every row in inventory §4 must appear in **both** sender and receiver role manuals.
- [ ] All 24 handoff rows referenced bidirectionally

---

## Final gate

- [ ] Every inventory row has a quick-start mention OR a reference section
- [ ] Every reference section names the related cross-role handoff(s)
- [ ] Every workflow doc names the trigger surface AND every receiver surface
- [ ] No screenshot-supported PDF is exported with any unchecked box above
