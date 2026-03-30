

## Prompt 21: Check-In History — All Views

### What gets built
1. A reusable `CheckInsTab` component showing check-in history with expandable details
2. Participant view of their own check-ins (via `/checkins` route or from `/card`)
3. Peer specialist view in the participant detail page (replaces placeholder)
4. Overdue check-in banner on caseload cards
5. Admin route stub for future use

### Changes

**1. Create `src/components/CheckInsTab.tsx`** — Shared check-in list component
- Props: `participantId`, `viewerRole` (`"participant" | "peer" | "admin"`)
- Fetches `weekly_checkins` for the participant, newest first, joining `peer_specialist_profiles` on `peer_specialist_id` to get peer name
- Also fetches `supervisor_feedback` where `target_type = 'checkin'` and `target_id` in the check-in IDs
- Each check-in card shows:
  - Date, mood indicator (colored circle: red/orange/amber/teal/green for 1-5)
  - "Logged by [peer name]" — if viewer is peer and authored it, show "By you" badge
  - Summary truncated to 2 lines with "Show more" toggle
- Expanding a check-in reveals: summary, plan progress, barriers, next steps
- Supervisor feedback indicator: small speech bubble icon if `supervisor_feedback` exists for this check-in; tapping shows the feedback text in a collapsible section
- Participants see view-only (no edit, no supervisor feedback indicator)

**2. Update `src/pages/ParticipantDetailPage.tsx`**
- Import `CheckInsTab`, replace `<PlaceholderTab label="Check-Ins" />` with `<CheckInsTab participantId={participantId!} viewerRole="peer" />`

**3. Create participant check-ins page `src/pages/ParticipantCheckInsPage.tsx`**
- Simple page wrapping `<CheckInsTab>` with `viewerRole="participant"`, using `get_participant_profile_id()` logic (query participant_profiles for current user to get profile ID)
- Title: "My Check-Ins"

**4. Update `src/App.tsx`**
- Replace `CheckInsPage` placeholder import for participant route `/checkins` with `ParticipantCheckInsPage`
- Add admin route `/admin/participants/:participantId/checkins` rendering `CheckInsTab` with `viewerRole="admin"` (simple wrapper page)

**5. Update `src/pages/CaseloadPage.tsx`** — Overdue banner
- Already has `lastCheckins` and `daysSinceCheckin` computed
- Add a red banner below each caseload card when `daysSinceCheckin > 7`: "Check-in overdue — [N] days since last check-in"
- Also show banner when no check-ins exist at all

### Technical notes
- `supervisor_feedback` query: `target_type = 'checkin'` and `target_id` in checkin IDs. RLS allows peer to read their own interactions.
- Mood colors reuse the same scale from `CheckInFormPage`: 1=red, 2=orange, 3=amber, 4=teal, 5=green
- Peer name join: `weekly_checkins.peer_specialist_id` → `peer_specialist_profiles.user_id`
- No DB migrations needed

