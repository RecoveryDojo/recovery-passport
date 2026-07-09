
# Assessment Extension — Build Plan (v3, three corrections applied)

Goal: enable the RE team to deploy standard instruments (PHQ-9, GAD-7) and author their own, without disturbing the live Recovery Capital (RC) system.

Core principle: **RC is not migrated.** It becomes "instrument #1" by convention. New instruments live in new tables and reuse `assessment_sessions` as the summary record via one nullable FK.

Verified against live schema:
- `assessment_sessions.completed_at` — `NOT NULL DEFAULT now()`. RC omits it on insert; generic take page does the same.
- `notification_type` — no assessment-flag value today. New enum value added in step 1, first referenced at runtime in step 4 (see §Enum sequencing).

---

## Schema changes (step 1 migration)

**Two nullable columns added to `assessment_sessions`:**
- `instrument_id uuid null references assessment_instruments(id)` — null = RC session.
- `assignment_id uuid null references assessment_assignments(id)` — null = RC or ad-hoc session. Set by the generic take page when the session was launched from an assignment, so cadence reporting (intake PHQ-9 vs. 30-day PHQ-9) and assignment completion are unambiguous. Without it, "mark the assignment done" would have to guess by participant + instrument + most-recent-pending, which breaks the moment a participant has two pending assignments of the same instrument at different cadences.

**Enum change:**
- `ALTER TYPE notification_type ADD VALUE 'assessment_flagged';` — distinct from `assessment_ready_for_review` so a self-harm flag is identifiable in the notification list.

**New tables** (all with RLS, GRANTs to authenticated + service_role, updated_at trigger):

- `assessment_instruments` — `title, description, source ('standard'|'custom'), is_locked bool, scoring_method ('sum'|'average'), produces_overall_score bool, status ('draft'|'published'|'archived'), version int, template_group_id uuid, created_by uuid, higher_is_better bool NOT NULL DEFAULT true, min_score numeric, max_score numeric`.
- `assessment_instrument_items` — `instrument_id, prompt, item_type ('labeled_scale'|'single_select'|'multi_select'|'yes_no'|'numeric'|'free_text'), sort_order, is_required, is_reverse_scored, is_flag_item, flag_threshold numeric, help_text`.
- `assessment_instrument_options` — `item_id, label, value numeric, sort_order`.
- `assessment_bands` — `instrument_id, min_score, max_score, label, severity ('none'|'mild'|'moderate'|'severe'), guidance, triggers_alert bool`. **Note:** PHQ-9 has five severity bands (minimal / mild / moderate / **moderately severe** / severe). Free-text `label` covers this display-side. If `severity` ever drives logic (e.g. escalation rules keyed on severity), add `'moderately_severe'` to the enum then. Flagged now so a future edit doesn't quietly collapse PHQ-9's 15–19 band into "severe."
- `assessment_responses` — `session_id → assessment_sessions, item_id, option_id null, numeric_value null, text_value null, points numeric, flagged bool`. RC keeps using `assessment_scores`; new instruments use this; no collision.
- `assessment_assignments` — `instrument_id, participant_id, assigned_by, cadence_tag ('intake'|'thirty_day'|'sixty_day'|'ninety_day'|'discharge'|'ad_hoc'), due_date, status ('pending'|'completed'|'skipped'|'expired')`.

**RLS pattern:** participants read own via `get_participant_profile_id()`; assigned peers via `is_assigned_peer(participant_id)`; admins via `get_user_role() = 'admin'`. Instrument/item/option/band definitions readable by any authenticated user; writes restricted to admin.

### Enum sequencing (explicit)

`ALTER TYPE ... ADD VALUE` cannot be used in the same transaction that adds it, and Supabase wraps each migration in a transaction. The step-1 migration therefore only *adds* `assessment_flagged` to `notification_type` — it does not reference it. First runtime reference happens in step 4 (safety-flag wiring), which runs after the migration has committed. Do not insert a `notifications` row with `type = 'assessment_flagged'` in the same migration that adds the value.

---

## Instrument valence — required to keep clinical color/scale correct

Verified: `AssessmentHistoryPage` colors `≤2 red / ≤3 amber / else green` and hardcodes chart Y-axis `[0, 5]`. `RcSparkline` and `use-participant-clinical-summary` share the same RC-baked semantics. RC is 0–5, higher-better; PHQ-9 is 0–27, higher-worse.

Rule: **no non-RC instrument renders on a shared surface with RC coloring/scaling.** Bundled with the chart fix in step 6:

1. `AssessmentHistoryPage` — resolve each session's instrument → `higher_is_better` + range. Normalize to a 0–1 concern index (`higher_is_better ? 1 - score/max : score/max`), then color. Chart segments by instrument (per-line Y-domain).
2. `RcSparkline` — filter to `instrument_id IS NULL` (RC only).
3. `use-participant-clinical-summary` — split by instrument or keep RC-only and add a separate non-RC feed. Never color non-RC against RC thresholds.

Fallback if any of the above slips: render non-RC as raw numbers, no color, excluded from RC visualizations.

---

## New code

1. **Generic take page** (`/assessment/take/:instrumentId`) — renders items by `item_type`, applies `is_reverse_scored`, sums/averages per `scoring_method`, writes `assessment_sessions` (`instrument_id`, `assignment_id` if launched from an assignment, `overall_score`; omit `completed_at`) + `assessment_responses`, evaluates bands + flags. **Hard rule: never calls `generate_recovery_plan` under any condition.** That RPC reads `assessment_scores` which new instruments don't populate.
2. **Instrument authoring UI** — new Content Hub tile "Assessment Library" at `/admin/content/instruments`. Standard = locked; custom = editable. Audit-log publish/edit/archive.
3. **History expanded view** — when session `instrument_id` is set, read `assessment_responses` joined to items/options instead of `assessment_scores`.
4. **Assignment surface** — peer assigns instrument + cadence + due date; participant sees pending list; **completion is matched by `assignment_id`, not guessed by participant+instrument+recency.** Peer-driven nudges only for v1 (no cron).
5. **Safety flags** — on session completion:
   - For each response, decide "flagged" based on **item type**:
     - `numeric` items: compare `numeric_value >= flag_threshold`.
     - Option-based items (`labeled_scale`, `single_select`, `yes_no`, `multi_select`): compare the resolved score of the response — the selected option's `value` (or the stored `points`, which is that value after reverse-scoring) — against `flag_threshold`. **Do not read `numeric_value` for these; it is null by design and would make every flag silently miss.** For `multi_select`, use the max of the selected options' values.
   - Or session `overall_score` lands in a band with `triggers_alert = true`.
   - Then: mark response `flagged = true`; insert `notifications` rows with `type = 'assessment_flagged'` to the assigned peer + admins (interim supervisor audience); surface `crisis_protocol` inline on take-page completion; force-route session to peer/supervisor confirmation — no silent auto-complete.
   - Correctness check for PHQ-9 item 9: answer "Several days" = option value 1, `flag_threshold = 1`, so the flag fires as intended.

## Peer confirmation for new instruments (explicit)

New instruments **require peer confirmation** via the same `assessment_sessions.confirmed_by` column and `confirm_assessment` audit action. Same review UI as RC (extended to render non-RC bodies). Any flagged session is force-routed regardless of instrument settings.

---

## Standard instrument seeding (data, after schema)

- **PHQ-9** — 9 items, 0–3 labeled scale, sum, `higher_is_better=false`, range 0–27, bands 0–4 / 5–9 / 10–14 / 15–19 / 20–27 (labels: minimal, mild, moderate, moderately severe, severe), **item 9 `is_flag_item=true, flag_threshold=1`** (matches on option value / `points`, not `numeric_value`).
- **GAD-7** — 7 items, 0–3 labeled scale, sum, `higher_is_better=false`, range 0–21, bands 0–4 / 5–9 / 10–14 / 15–21.
- **BARC-10** — not seeded in v1 (licensing unconfirmed). Follow-up.

## Explicitly out of scope

- Not touching `AssessmentTakePage`, `assessment_domains`, `assessment_domain_levels`, `assessment_scores`, `generate_recovery_plan`.
- No supervisor role; alerts go to admins as interim supervisor audience.
- No cron reminders; no per-domain subscales for custom instruments.

---

## Build order

1. Migration: 6 new tables + `instrument_id` + `assignment_id` columns on `assessment_sessions` + `higher_is_better`/range on instruments + `assessment_flagged` enum value (added, not yet referenced) + RLS + GRANTs.
2. Content Hub "Assessment Library" tile + authoring UI.
3. Generic take page + response writer + scoring engine + band evaluator (with never-call-`generate_recovery_plan` guard, and item-type-aware flag evaluation).
4. PHQ-9 + GAD-7 seed + safety-flag wiring (first runtime use of `assessment_flagged` + crisis surface + force-route to confirmation).
5. Assignment + cadence (peer assign, participant list, completion matched by `assignment_id`).
6. **Valence + trend chart fix together** — `AssessmentHistoryPage`, `RcSparkline`, `use-participant-clinical-summary`. No non-RC instrument exposed on a shared surface until this ships.

RC keeps working through all six steps.
