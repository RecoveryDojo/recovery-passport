

# 💰 Fix Admin Payments — make it actually reachable + participant-aware

## What's broken
You're at `/admin/participants/:participantId/payments` with the literal string `:participantId` in the URL. The page expects a real UUID, but you arrived without one — so there's no participant context and no picker.

## Root cause
- Nothing in the app links to this page (no sidebar entry, no row action, no tab in the new participant sheet).
- The page was built as a deep-link sub-page of a participant, but the parent participant sheet never got a "Payments" link added.

## The fix — 2 small edits

### 1. `src/components/AdminParticipantDetailSheet.tsx` (Care Team or Notes tab area, or sticky header action row)
Add a "View Payments" button/link in the participant sheet that navigates to `/admin/participants/${participant.id}/payments`. Place it in the **sticky header action row** next to the existing nav buttons (Check-ins, Notes) so it's consistent with the existing deep-link pattern.

### 2. `src/pages/AdminPaymentsPage.tsx` — add a guard for missing/invalid IDs
Same UUID guard pattern we used on `/caseload/:participantId`:
- If `participantId` is missing, equal to `:participantId`, or not a valid UUID → render a friendly "Select a participant first" empty state with a button back to `/admin/participants`
- Prevents the broken state you just hit

## What you'll see after the fix
- 👑 `/admin/participants` → click any participant row → sheet opens → click **"Payments"** in the header → lands on that participant's payment ledger with their name shown and the "Log Entry" form scoped to them.
- Typing `/admin/participants/:participantId/payments` directly → friendly empty state, not a broken form.

## Verification
1. Admin → `/admin/participants` → click any row → click "Payments" in the header → confirm participant name shows at top
2. Log a $10 charge → confirm it appears in the ledger and an `audit_log` row is created (already wired from Phase 5)
3. Try `/admin/participants/abc/payments` directly → confirm friendly empty state with "back to participants" button

