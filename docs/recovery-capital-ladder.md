# Recovery Capital Ladder

The Recovery Capital Assessment (RCA) is the **shared scoreboard** of the app. A
participant's goal is a 10 in every domain. Every feature must answer:
**"How does this move a participant up the ladder?"**

This doc maps each of the 10 domains (from `assessment_domains`, sort order
honored) to the tools and surfaces that support climbing it.

> Seed-data gaps are flagged with **⚠ GAP**. These are not bugs — they are
> backlog items for content authoring (admin can fill from `/admin/*` pages).

---

## 1. Housing Stability

- **Score signal**: `assessment_scores.score` for `assessment_domains.name='Housing Stability'`
- **Plan steps that move it up**: 1 step in `plan_template_steps` with `domain_tag` → Housing Stability (triggered when score ≤ 2)
- **Milestones related**: `Secured Housing Plan` (sort 9, level_threshold 3)
- **Peer support tools**:
  - MI prompts: ⚠ GAP — no `situation_tag` for housing specifically; peer falls back to `barriers` (5 prompts) or `planning` (5 prompts)
  - Note templates: `referral`, `transition` (use when discharge plan involves housing)
  - Community partners: ⚠ GAP — no `housing` partner type seeded yet (only `employment`, `food`, `legal`, `medical`, `mental_health`)
- **Where it shows up**:
  - P `/card` RC sparkline + per-domain breakdown
  - P `/plan` "Housing" step group
  - PS `/caseload/:id` Journey tab → Housing progress bar + RC trend
  - A sheet Journey tab → same + "Confirm assessment" + supervisor feedback hook

## 2. Employment / Income

- **Plan steps**: 1 domain-tagged step
- **Milestones**: `Employment or Education Connected` (sort 11, threshold 4)
- **MI prompts**: `motivation` (5), `planning` (5)
- **Note templates**: `referral`
- **Community partners**: `employment` (1 seeded)
- **Surfaces**: P `/card`, P `/plan`, P `/resources`, PS `/caseload/:id` Journey, A sheet Journey

## 3. Social Support

- **Plan steps**: 1 domain-tagged step
- **Milestones**: `Connected to Sponsor/Mentor` (sort 5, threshold 2), `Attended First Group` (sort 4, threshold 2)
- **MI prompts**: `ambivalence` (5), `motivation` (5)
- **Note templates**: `general`, `milestone`
- **Community partners**: ⚠ GAP — no `peer_support` type seeded
- **Surfaces**: P `/card`, P `/plan`, PS Journey, A Journey

## 4. Physical Health

- **Plan steps**: 1 domain-tagged step
- **Milestones**: ⚠ GAP — no health-specific milestone (covered indirectly by `First 72 Hours`, `First 7 Days`)
- **Note templates**: `general`, `crisis` (when health = crisis)
- **Community partners**: `medical` (1 seeded)
- **Surfaces**: P `/card`, P `/plan`, P `/resources`, PS Journey, A Journey

## 5. Mental Health

- **Plan steps**: 1 domain-tagged step
- **Milestones**: ⚠ GAP — no mental-health-specific milestone
- **Note templates**: `crisis` (use when MH crisis), `general`
- **MI prompts**: `crisis` (5), `ambivalence` (5)
- **Community partners**: `mental_health` (1 seeded)
- **Crisis flow**: `note.crisis` event → A red alert + 14-day caseload card dot
- **Surfaces**: P `/card`, P `/plan`, P `/resources`, PS Journey + Overview risk flag, A Overview risk flag

## 6. Substance Use Risk

- **Plan steps**: 1 domain-tagged step
- **Milestones**: `30 Days`, `60 Days`, `90 Days` (time-based proxies for sustained sobriety)
- **MI prompts**: `ambivalence` (5), `motivation` (5), `crisis` (5) — most coverage of any domain
- **Note templates**: `crisis`, `general`, `milestone`
- **Self-care alert link**: PS self_care_checks `is_flagged` → A awareness, indirectly protects this domain via peer wellness
- **Surfaces**: P `/card`, P `/plan`, PS Journey, A Journey

## 7. Legal Status

- **Plan steps**: 1 domain-tagged step
- **Milestones**: ⚠ GAP — none
- **Note templates**: `referral`
- **Community partners**: `legal` (1 seeded)
- **Surfaces**: P `/card`, P `/plan`, P `/resources`, PS Journey, A Journey

## 8. Community Involvement

- **Plan steps**: ⚠ GAP — 0 domain-tagged steps in any template
- **Milestones**: ⚠ GAP — none
- **MI prompts**: `motivation`, `planning`
- **Note templates**: `general`, `milestone`
- **Community partners**: ⚠ GAP — no `community` type
- **Surfaces**: P `/card` (display only — no action paths until gaps closed)

## 9. Life Skills

- **Plan steps**: 1 domain-tagged step
- **Milestones**: `Discharge Plan Approved` (sort 12, threshold 4)
- **Note templates**: `general`, `transition`
- **Surfaces**: P `/card`, P `/plan`, PS Journey, A Journey

## 10. Sense of Purpose

- **Plan steps**: ⚠ GAP — 0 domain-tagged steps
- **Milestones**: ⚠ GAP — none directly
- **MI prompts**: `motivation` (5)
- **Note templates**: `general`, `milestone`
- **Surfaces**: P `/card` (display only — no action paths until gaps closed)

---

## Cross-domain milestones (apply regardless of domain score)

| Milestone | Threshold | When unlocked |
|---|---|---|
| Completed Intake | 1 | `IntakePage` finish |
| First 72 Hours | 1 | `MilestonesTab` after 3 days in recovery |
| First 7 Days | 1 | Same, 7 days |
| Completed First Assessment | 3 | After first `assessment_sessions.completed_at` |
| Completed Second Day _(unscored — orphaned legacy?)_ | null | ⚠ Verify if still in use |

`recalculate_card_level()` runs after each unlock — milestone count drives `card_level`:
0–3 = rookie, 4–6 = starter, 7–9 = veteran, 10+ = all_star.

---

## Backlog (gaps the user/admin should decide on)

1. Add `housing`, `peer_support`, `community` to `community_partners.type` seed.
2. Add MH and Health milestones to `milestone_definitions` (e.g., "Established Care", "First Therapy Visit").
3. Add domain-tagged plan steps for **Community Involvement** and **Sense of Purpose** in `plan_template_steps`.
4. Decide whether `Completed Second Day` (no level_threshold) is still active or should be deactivated.
5. Consider adding `housing`, `health`, `mental_health` to `mi_situation_tag` enum so MI prompts can be tagged per-domain.

These are seed-data decisions — they do **not** require migrations.
