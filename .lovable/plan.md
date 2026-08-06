# Intake Packet Review (Admin)

Give admins a single page that shows every piece of a completed intake session in one scrollable, printable packet.

## Where it lives

- New route: `/admin/intake-sessions` — list of all intake sessions (filter: status, peer, program, date range; search by participant name).
- New route: `/admin/intake-sessions/:sessionId` — the full packet for one session.
- Add an "Intake Packet" link on the admin participant detail page and on the peer caseload participant detail page (peer sees only their own participants' packets — read-only).

## What the packet page shows

Rendered top-to-bottom, each section collapsible, all read-only:

1. **Header** — participant name, DOB, program, admission date, peer who ran intake, session status, started/completed timestamps.
2. **Signed forms (steps 2–8)** — for each of the 7 forms: template title, the exact text version the participant signed, participant + peer signature images pulled from the `signatures` bucket via signed URLs, signed-at timestamp, IP/user-agent if captured.
3. **Goals (step 9)** — participant's stated goals + any peer notes.
4. **First assessment (step 10)** — instrument name, per-domain scores, total, link to the full assessment history view.
5. **Clinical picture (step 11)** — substances reported, medical history, medications, allergies.
6. **Demographics (step 12)** — all fields, with "Prefer not to say" rendered explicitly (not blank).
7. **Screening (step 13)** — UA panel results, screening flags.
8. **Belongings (step 14)** — itemized log with any staff notes.
9. **Room + completion (steps 15–16)** — room assignment note, final review notes.
10. **Audit trail** — every `audit_log` row for this session (started, resumed, completed) with timestamps and actor.

## Print / export

- "Print packet" button uses a print-optimized CSS layout (each section starts on a new page, signatures render inline).
- No PDF generator added in this pass — browser print-to-PDF covers admin need.

## Access

- Admin: sees every session.
- Peer specialist: sees packets only for participants where `is_assigned_peer(participant_id)` — reuses existing RLS helper.
- Participant: not included here; they already have `MyIntakePage`.

## Data + RLS

No new tables. Reads from: `intake_sessions`, `intake_form_signatures` (+ `intake_form_templates`), `intake_goals` (or wherever step 9 wrote), `assessment_sessions`/`assessment_scores`, `intake_substance_use`, `intake_clinical_details`, `participant_demographics`, `intake_screening_results`, `intake_ua_panels`, `intake_belongings_log`, `audit_log`.

Verify current RLS on each table allows: admin (via `get_user_role() = 'admin'`) and assigned peer (via `is_assigned_peer`). Flag any table missing an admin SELECT policy in the build step and add it in a single migration before wiring the UI.

Signature images: generate short-lived signed URLs from the private `signatures` bucket at render time — no bucket policy changes.

## Files to add

- `src/pages/AdminIntakeSessionsPage.tsx` — list + filters.
- `src/pages/AdminIntakePacketPage.tsx` — the packet view (composed of section components).
- `src/components/intake/packet/` — one small read-only component per section (`SignedFormsSection`, `GoalsSection`, `FirstAssessmentSection`, `ClinicalSection`, `DemographicsSection`, `ScreeningSection`, `BelongingsSection`, `RoomSection`, `AuditTrailSection`, `PacketHeader`).
- `src/components/intake/packet/PrintablePacket.tsx` — wraps everything with print CSS.
- Route wiring in `src/App.tsx`; nav tile on `AdminDashboard` and link on `CaseloadParticipantDetailPage` / admin participant detail.

## Out of scope (call out, don't build)

- Editing intake data after completion.
- Server-side PDF generation.
- Bulk export / CSV of packets.

## Verification

- Manually open a completed session (e.g. one of the seeded demo participants) as admin — every section renders with data or an explicit "Not provided".
- Open the same packet as the assigned peer — renders. As a different peer — 403 / not found.
- Print preview shows clean page breaks and inline signatures.
