

# Phase 3 — Workflow Map

Translate the Coverage Inventory §7 (16 workflows) into a single operational document that drives every Phase 4 quick-start and Phase 5 reference manual.

## Deliverable

One new file: **`docs/training-workflow-map.md`**

## Structure (every workflow uses the same 5-part shape)

1. **Trigger** — what real-world event starts it
2. **Actor & surface** — who acts, where, in what state
3. **Step-by-step** — exact in-app actions with surface references and signal markers (⚡ realtime, 🔔 notification, 📜 audit)
4. **Expected result** — toasts, navigation, state changes
5. **Cross-role impact** — what other roles see, where, via which signal
6. **Edge states** — empty / pending / error / overdue / expired variants

## The 16 workflows (all sourced from inventory §7, never from memory)

| ID | Workflow | Inventory rows | Event-contract rows |
|---|---|---|---|
| WF-01 | Onboarding (intake → profile setup → first card) | G-2/3/4, P-1 | (pre-account) |
| WF-02 | Peer request → approval (Stage 3 unlock) | P-10, PS-2, A-1 | peer_request.* |
| WF-03 | Assessment cycle (self-assess → confirm → plan generated) | P-3/4, PS-7, A-4 | assessment.completed/confirmed |
| WF-04 | Plan generation & progression | P-5, PS-7 | plan_step.completed / phase.advanced |
| WF-05 | Weekly check-in cycle (incl. low-mood path) | PS-5/6/7, P-11, A-9 | checkin.logged / checkin.low_mood |
| WF-06 | Notes & crisis handling | PS-7, A-11 | note.created / note.crisis |
| WF-07 | Milestone unlock → level-up celebration | PS-7, P-1/2 | milestone.unlocked / level_up |
| WF-08 | Referrals & resources (placement + discharge) | P-6/7, PS-7, A-8 | referral.created |
| WF-09 | Agreements & compliance | P-12, A-8 | agreement.published/acknowledged |
| WF-10 | Passport sharing (consent → share/QR → revoke/expire) | P-8, G-5, A-13 | consent.created / shared_link.created |
| WF-11 | Payments | A-10, P-13 | payment.recorded |
| WF-12 | Reports (filter → generate → CSV/Print → audit) | A-12 | (audit-only) |
| WF-13 | Notifications (cross-role bell + page) | G-6/7 | (all notif-bearing events) |
| WF-14 | Peer wellness & CRPS (self-care + hours + eligibility) | PS-8/9, A-7, A-1 | self_care.* / crps.eligible |
| WF-15 | Admin oversight (dashboard alert triage → drill-in) | A-1/3/4/5/6 | (all dashboard signals) |
| WF-16 | Public passport view (anonymous + audit RPC) | G-5 | (view-only) |

## Coverage discipline baked in

- Every workflow cites **inventory row IDs** and **event-contract row IDs** so reconciliation in Phase 6 is mechanical
- Final section is a coverage cross-check table mapping every WF-## to its matrix gate (TCM-W#)
- Explicit Phase 3 → Phase 4 handoff rules:
  - Phase 4 quick-starts = top 5–8 high-frequency workflows per role, citing WF-## IDs
  - Phase 5 references = every WF-## **plus** every inventory row not in a workflow (passive surfaces, Offline banner, Install prompt, 404, etc.)
  - Phase 6 reconciles all of it against the matrix before any PDF export

## What this does NOT touch

- No code changes
- No edits to inventory, matrix, interdependency-map (those stay frozen as source of truth)
- No quick-start or reference prose yet — that's Phase 4 / 5

## After approval

I switch to default mode, write `docs/training-workflow-map.md`, and the new file becomes selectable in the `/admin/docs` viewer automatically (just need to add one entry in the sidebar list).

Approve and I'll execute.

