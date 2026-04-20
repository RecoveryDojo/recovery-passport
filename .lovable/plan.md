

# Recommendation: Yes — ship Sprint 0 (Interdependency Architecture) before anything else

## Why now, not later

You just approved three big sprints back-to-back: peer detail page, caseload triage, and the admin 5-tab sheet. Every one of them creates new cross-role signals (a peer logs a check-in → admin sees engagement pill flip → participant sees "last contact" update → supervisor feedback may follow → peer gets a badge → admin sees acknowledgment). If we build those sprints first and Sprint 0 second, three things go wrong:

1. **Signals get hardcoded inconsistently.** Each new tab will invent its own `notifications.insert` and `audit_log.insert` calls. By sprint end you'll have 30+ ad-hoc inserts with slightly different `type` values, link formats, and metadata shapes — impossible to refactor cleanly later.
2. **Realtime channels get named ad-hoc.** The CardPage already listens on `card-${id}`, `milestones-${id}`, `assessments-${id}`. The new peer detail page will invent `caseload-detail-${id}` and the admin sheet will invent something else. Cache invalidation drifts. Bugs ship silently.
3. **The Recovery Capital ladder stays implicit.** We'll build tabs that *look* clinical without proving each surface actually moves a participant up the 10-domain ladder. Gaps (domains with no plan steps, milestones with no domain link, MI prompts with no situation tag) won't surface until late.

Doing Sprint 0 first costs ~1 day and saves ~3 days of refactoring across the next sprints. Every tab in the upcoming work then has a documented row in the contract — no ambiguity, no orphan signals.

## What ships in Sprint 0

**3 documentation artifacts** (the contract):
- `docs/interdependency-map.md` — one row per event: trigger, DB write, receivers, surfaces, notification type, realtime channel
- `docs/recovery-capital-ladder.md` — for each of 10 RCA domains: how a participant moves up, which milestones/plan steps/MI prompts/community partners support it, where it shows up in each role's UI, **flagged gaps in seed data**
- `docs/role-surface-matrix.md` — inverse index: for each screen, which signals it must render

**2 thin runtime helpers** (enforce the contract):
- `src/lib/events.ts` — typed `AppEvent` union + `emitEvent(event, payload)` helper that writes `audit_log` and (when applicable) `notifications` in one call
- `src/lib/realtime-channels.ts` — constants for every realtime channel name + matching React Query invalidation keys

**2 reference migrations** (prove the helpers work, no behavior change):
- `src/hooks/use-log-checkin.ts` — replace the low-mood admin notify block with `emitEvent("checkin.low_mood", ...)`
- `src/pages/CardPage.tsx` — replace the level-up notification insert with `emitEvent("level_up", ...)`

## What Sprint 0 does NOT do

- No DB migrations, no new tables, no new columns, no RPC changes
- No UI changes anywhere
- No new tests (the docs are the spec future tests get written against)
- No changes to existing notification UX — `emitEvent` produces the exact same `notifications` rows the old code did

## Build order inside Sprint 0

1. Read `assessment_domains`, `milestone_definitions`, `mi_prompts`, `note_templates`, `community_partners`, `plan_template_steps` to ground the docs in real seed data
2. Write `docs/interdependency-map.md`
3. Write `docs/recovery-capital-ladder.md` with seed-data gaps flagged for your review
4. Write `docs/role-surface-matrix.md`
5. Create `src/lib/events.ts` with typed enum + helper
6. Create `src/lib/realtime-channels.ts` with channel + invalidation key constants
7. Migrate the two reference call sites — verify behavior unchanged
8. Add a "How to add a new event" section at the bottom of the interdependency map

## After Sprint 0 ships

The previously approved plans run in this order with the contract as their reference:
1. `useParticipantClinicalSummary` shared hook (the data foundation)
2. Peer detail page `/caseload/:id` (5 tabs, action-oriented)
3. Caseload health header + sort/filter on `/caseload`
4. Card-level quick actions, crisis dot, supervisor-feedback badge
5. Admin sheet refactor to 5 tabs using the shared hook

Every tab in steps 2–5 references a row in the interdependency map and uses `emitEvent()` instead of raw notification inserts. No drift.

## My recommendation

Ship Sprint 0 first. It's the cheapest sprint in the queue and it guarantees the next four sprints don't accumulate technical debt. After Sprint 0, we move straight into the shared hook and the peer detail page.

