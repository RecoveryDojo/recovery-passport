

# Sprint Status — Where we are

## ✅ Done

| Phase | Scope | Surface |
|---|---|---|
| **2A** | Today section (mood + focus + next milestone preview) | 🟢 Participant `/card` |
| **2B** | Baseball card refactor (streaks, RC sparkline, QuickActionFab) | 🟢 Participant `/card` |
| **2C** | AskYourPeer + ReflectionJournal + ResourceOfTheDay + LevelRoadmapModal | 🟢 Participant `/card` |
| **3** | CaseloadHealthHeader (4 tiles) + QuickActionsMenu (`…`) + 5-tab CaseloadParticipantDetailPage | 🔵 Peer `/caseload` and `/caseload/:id` |
| **3.1 fix** | CRPS edge function 500 fix + fire-and-forget wrapper | 🔵 Peer check-in / note flows |
| **3.2 fix** | UUID guard on `/caseload/:participantId` | 🔵 Peer detail page |

## 🟡 Not done — what's left in the sprint

### Phase 4 — 👑 Admin Participant Detail Sheet 5-tab refactor
**Where you'll see it:** `/admin/participants` → click any participant row → side sheet
**Currently showing:** old 3-card layout (Overview / Peer Assignment / Recent Check-ins) — confirmed still in `src/components/AdminParticipantDetailSheet.tsx`
**Will become:** sticky header (name, email, recovery days, peer badge, level pill, phase pill) + 5 tabs (Overview · Journey · Engagement · Care Team · Notes), powered by the same `useParticipantClinicalSummary` hook the peer side uses. One source of truth across both roles.

### Phase 5 — 🔧 Notification + audit emitEvent sweep
**Where you'll see it:** 🟢 participant notification bell + 👑 admin `/admin/audit` page
**What it does:** Audit existing write paths (milestone unlock, peer request approve/reject, plan generation, payment record, referral creation, consent record creation) and add the missing `emitEvent()` calls so notifications fire and audit_log rows get written. No new UI — fills gaps in existing UI.

## Recommended order

1. **Phase 4 first** (visible, high-value — fixes the admin sheet you opened earlier)
2. **Phase 5 second** (polish + compliance — completes the sprint)

Reply "do Phase 4" or "do both" and I'll execute.

