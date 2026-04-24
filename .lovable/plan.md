

# Phase 3.5 — Reframe: Task Playbook (Training-First)

You are right — Phase 3's trigger-oriented map is a **system reference**, not training material. Real staff training has to start from "I am sitting down to do my job — what do I do?"

## What changes

- Phase 3 deliverable (`docs/training-workflow-map.md`) is **renamed and re-labeled** as a system-event reference, not training.
- A new training-first deliverable is built: the **Task Playbook**.
- All future Phase 4/5 quick-starts and manuals are sourced from the Task Playbook, not the event map.

## New deliverables

### 1. Rename existing file
`docs/training-workflow-map.md` → `docs/system-event-map.md`
- Add a header banner: *"This is an engineering / audit reference. For training material, see the Task Playbook."*
- Keep all 16 trigger-based workflows intact.

### 2. New file: `docs/task-playbook.md`
The single source of truth for all training. Every task = one job a real person sits down to do.

**Format per task (fixed shape):**
```text
TASK ID:   T-ADMIN-04
TITLE:     Run a weekly peer specialist productivity report
ROLE:      Admin
CADENCE:   Weekly (Monday mornings)
TIME:      ~5 minutes
GOAL:      One sentence — why you do this
WHERE:     Exact route(s) in the app
PREREQS:   What must already exist (e.g. "at least one approved peer")
STEPS:     Numbered, click-by-click
RESULT:    What success looks like (toast, screen state, exported file)
IF SOMETHING'S OFF: 2–3 common edge cases
LINKED:    System events triggered (cross-reference to system-event-map.md)
```

**Estimated count:** 50–70 tasks across all roles (one job per workflow, per your decision).

### 3. Source discipline (the path I recommend for training)

Hybrid — gets the rigor without the rigid 1:1 cage:

- **Inventory is the ceiling, not the cage.** Every surface, action, and state in `training-coverage-inventory.md` must be reachable by **at least one** task. Reconciliation pass at the end flags orphans.
- **Tasks may span multiple inventory rows.** A real task like "Approve a pending peer specialist" naturally touches the peer review queue, the peer detail sheet, the approval action, and the notification — that's one task, not four.
- **Tasks may NOT invent surfaces.** If a step references something not in the inventory, it's flagged in a `?` queue for me to verify against the actual app before publishing.
- **Final reconciliation table** at the bottom of `task-playbook.md`:
  - Inventory row → covered by which T-### tasks
  - Any inventory row with zero tasks = a known training gap (called out, not hidden)
  - Any task referencing nothing in inventory = blocked until verified

This is how staff manuals are actually built: write the job, then prove every screen the job touches is real.

## How the playbook is organized

Three role sections, alphabetized within each by cadence then alphabetical:

```text
## Participant tasks         (~15–20 tasks)
   Daily:    log a check-in, update mood, view today's focus
   Weekly:   complete weekly check-in, review plan progress
   Periodic: take an assessment, share passport with provider, update profile

## Peer Specialist tasks     (~20–25 tasks)
   Daily:    triage caseload, respond to peer requests, log notes
   Weekly:   review check-ins for caseload, log CRPS hours, run self-care check
   Periodic: discharge planning, agreement re-acknowledgment, crisis protocol

## Admin tasks               (~15–20 tasks)
   Daily:    review dashboard alerts, approve pending peers
   Weekly:   run peer productivity report, run participant outcomes report, review audit log
   Periodic: publish new agreement, add resource, configure milestones, generate program report
```

## What this does NOT touch

- No code changes.
- No edits to `training-coverage-inventory.md`, `training-coverage-matrix.md`, `interdependency-map.md`, or `recovery-capital-ladder.md`.
- The old `training-workflow-map.md` content is preserved (just renamed and relabeled).

## Viewer integration

`/docs` sidebar gets a new top group: **"Playbooks"** containing the Task Playbook. The renamed System Event Map moves into the **"Reference"** group alongside the inventory and matrix.

## After approval

I switch to default mode and:
1. Rename `training-workflow-map.md` → `system-event-map.md` and add the banner.
2. Create `docs/task-playbook.md` with the full task list (all 50–70 tasks written out).
3. Update `src/pages/AdminDocsPage.tsx` to add the new "Playbooks" group and the renamed system-event entry.
4. Run the reconciliation pass and append the inventory-coverage table.

Approve and I'll execute.

