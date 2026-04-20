

# Where everything lives + finish the Phase 3 wiring

## What IS already wired (you just need to find it on screen)

**On `/card` — scroll DOWN past the baseball card:**

```text
┌─────────────────────────────┐
│ TODAY section               │ ← Phase 2A (mood + focus + next milestone)
├─────────────────────────────┤
│ ⚾ BASEBALL CARD            │ ← Phase 2B (streaks, RC sparkline inside)
│   [tap level badge ↓]       │ ← opens LevelRoadmapModal ✅
├─────────────────────────────┤
│ Ask Your Peer card          │ ← Phase 2C ✅ (only visible if a peer is assigned)
│ Reflection Journal          │ ← Phase 2C ✅
│ Resource of the Day         │ ← Phase 2C ✅ (only visible if community_partners exist)
├─────────────────────────────┤
│ Journey stage banner        │
└─────────────────────────────┘
+ floating QuickActionFab      ← Phase 2B ✅ (bottom-right circle button)
```

**Why specific cards may be invisible right now:**
- **Ask Your Peer** — hides itself when no peer is assigned (returns `null`). Check your participant has `assigned_peer_id` set.
- **Resource of the Day** — hides itself when no `community_partners` rows are approved + available. Check the table has data.
- **Reflection Journal** — always visible. If you don't see it, you haven't scrolled far enough.
- **Level Roadmap Modal** — only opens when you tap the colored level badge (⚾ ROOKIE / STARTER / etc.) at the bottom of the baseball card.

## What is NOT wired yet (the actual gap)

`CaseloadHealthHeader` and `QuickActionsMenu` exist as files but are not mounted. The original Phase 3 plan included this and it was missed. I'll finish it now:

### Edit `src/pages/CaseloadPage.tsx`
- Import `CaseloadHealthHeader`
- Build a `lastMoods` map from the existing `weekly_checkins` query (one extra `mood_status` column, no new query)
- Mount `<CaseloadHealthHeader participants={caseload} lastCheckins={lastCheckins} lastMoods={lastMoods} />` directly under the "My Caseload" h1, above the self-care banner

### Edit `src/components/CaseloadParticipantCard.tsx`
- Import `QuickActionsMenu`
- Add a `…` button in the top-right of the card header (next to the chevron) that opens `QuickActionsMenu`
- Wire its actions: "Log Check-In" opens the existing `LogCheckInSheet`, "View Full History" navigates to `/caseload/:id`, "Add Note" navigates to `/caseload/:id?tab=notes`

No new queries, no new files, no DB changes. This is purely the missing wiring from Phase 3.

## After this fix, your verification path

1. **`/card`** (participant) — scroll down, confirm you see Ask Your Peer (if peer assigned) → Reflection Journal → Resource of the Day. Tap the ⚾ level badge → LevelRoadmapModal opens.
2. **`/caseload`** (peer) — confirm the 4-tile health header (Caseload / Crisis / Overdue / All-Star) appears at the top.
3. **Caseload card `…` menu** — tap it on any participant row, confirm Log Check-In / Add Note / View Full History work.

