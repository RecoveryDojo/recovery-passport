

# Unified Sprint v2 — Execution Plan (approved, building now)

This is the build I'm executing top-to-bottom. No new decisions in this plan — it's the v2 plan you already approved, restated as the execution checklist with the 5 sub-phase checkpoints I'll post against.

## Execution order

```text
Phase 1   Shared hook                          → checkpoint
Phase 2A  Migration + Today section            → checkpoint
Phase 2B  Card enhancements                    → checkpoint
Phase 2C  Conversation surfaces (+ migration)  → checkpoint
Phase 3   Peer caseload + detail page          ┐
Phase 4   Admin sheet 5-tab refactor           ├ → final checkpoint
Phase 5   Notification sweep → emitEvent()     ┘
```

## Phase 1 — Shared data spine
**New:** `src/hooks/use-participant-clinical-summary.ts` — single React Query hook returning profile, active phase, plan steps, milestones (earned + next-eligible), last 6 assessment sessions, 8 weeks of `weekly_checkins`, last 5 `progress_notes`, agreement/consent/shared_link counts, assigned peer's caseload size, supervisor_feedback. Subscribes to `channels.checkins/notes/milestones/assessments/plan` and invalidates matching `qk.*` keys.

## Phase 2A — Migration + "Today" section
**Migration:** RLS policy on `weekly_checkins` to allow participant self-insert + drop NOT NULL on `peer_specialist_id`.
**New hook:** `src/hooks/use-log-mood.ts` — mood-only insert, no peer/contact_mode required, emits `checkin.logged` + `checkin.low_mood`.
**New components under `src/components/card/`:** `TodaySection.tsx`, `MoodWidget.tsx`, `TodayFocusCard.tsx`, `NextMilestonePreview.tsx`.
**Edited:** `CardPage.tsx` — mount `<TodaySection />` above the card (~10 line delta).

## Phase 2B — Card enhancements
**New components under `src/components/card/`:** `StreakStats.tsx`, `RcSparkline.tsx`, `QuickActionFab.tsx`.
**Edited:** `CardPage.tsx` — mount streaks inside card, swap RC number for sparkline, mount FAB at page root (~15 line delta).

## Phase 2C — Conversation surfaces
**Migration:** RLS policy on `progress_notes` to allow participants to insert their own notes (author_id = auth.uid() AND participant_id = own).
**New components under `src/components/card/`:** `AskYourPeerCard.tsx`, `ReflectionJournal.tsx`, `ResourceOfTheDay.tsx`, `LevelRoadmapModal.tsx`.
**Edited:** `CardPage.tsx` — stack the four under the card, wire level badge to open modal (~15 line delta).

## Phase 3 — Peer caseload + detail
**New:** `src/components/caseload/CaseloadHealthHeader.tsx`, `src/components/caseload/QuickActionsMenu.tsx`, `src/pages/CaseloadParticipantDetailPage.tsx` (5 tabs: Overview · Journey · Engagement · Care Team · Notes), all using `useParticipantClinicalSummary`.
**Edited:** `CaseloadPage.tsx` (mount header + sort/filter), `CaseloadParticipantCard.tsx` (crisis dot, feedback badge, `…` menu), `App.tsx` (add `/caseload/:id` route).

## Phase 4 — Admin sheet 5-tab refactor
**New:** `src/hooks/use-supervisor-feedback.ts` (shared with `AdminPeerReviewPage`).
**Edited:** `AdminParticipantDetailSheet.tsx` — sticky header + 5 tabs (Overview · Journey · Engagement · Care Team · Notes & Compliance), uses `useParticipantClinicalSummary`.

## Phase 5 — Notification sweep
Replace ad-hoc `notifications`/`audit_log` inserts at: peer approve/reject, payment recorded, agreement published, peer assignment, peer_request create/respond, referral created, consent created, shared_link created — all → `emitEvent()`. No behavior change.

## Guardrails enforced during build
- `CardPage.tsx` ≤40 line delta total across 2A+2B+2C
- One feature = one file under `src/components/card/`
- Every new component reads from `useParticipantClinicalSummary` (no per-component Supabase queries)
- No cross-sub-phase imports
- Sub-phase boundary = short summary post before continuing

## Final deliverable
A "sprint complete" message listing every file changed + a 4-step verification checklist (test `/card` → `/caseload` → `/caseload/:id` → admin sheet).

