

## Prompt 20: Weekly Check-In Form + MI Prompt

### What gets built
A new check-in form page at `/caseload/:participantId/checkin` where peer specialists record weekly check-ins with contextual MI prompts, plus a "New Check-In" button on the participant detail page.

### Changes

**1. Add "New Check-In" button to ParticipantDetailPage** (`src/pages/ParticipantDetailPage.tsx`)
- Add an amber "New Check-In" button between the baseball card and the tabs section
- Links to `/caseload/${participantId}/checkin`

**2. Create CheckInFormPage** (`src/pages/CheckInFormPage.tsx`)
- New full page with back link to participant detail
- Title: "Weekly Check-In — [first name]"
- Fetches participant profile to get the first name
- Seven fields:
  - **Date**: Shadcn date picker, defaults to today
  - **Mood**: 5 tappable buttons (Crisis/Struggling/Getting By/Good/Thriving) with red/coral/amber/teal/green colors
  - **Situation**: Dropdown with 7 options mapped to `mi_situation_tag` enum values. On select, fetches a random active `mi_prompt` matching the tag. Displays in a yellow box with thumbs up / not relevant buttons that increment `usage_count` + `helpful_count` or `not_relevant_count`
  - **Summary**: textarea
  - **Plan Progress**: textarea
  - **Barriers**: textarea
  - **Next Steps**: textarea
- **Submit**: inserts into `weekly_checkins`, calls `supabase.rpc('log_checkin_crps_hours')`, creates notification for participant (type `general` since no specific checkin type exists), redirects to participant detail with `?tab=checkins`
- **Crisis overlay**: if situation was "crisis", after submit show full-screen overlay with `crisis_protocol` content (fetched where `is_current = true`), dismissible with "Got it, continue" button

**3. Add route** (`src/App.tsx`)
- Add `/caseload/:participantId/checkin` route under peer specialist routes, pointing to `CheckInFormPage`

**4. Update ParticipantDetailPage tabs** (`src/pages/ParticipantDetailPage.tsx`)
- Read `?tab=` query param to set default tab (so redirect from check-in lands on Check-Ins tab)

### Technical notes
- `weekly_checkins.participant_id` references `participant_profiles.id` (not user_id)
- `weekly_checkins.peer_specialist_id` references `users.id` (the peer's auth user id)
- `mi_situation_tag` enum: `first_checkin`, `ambivalence`, `barriers`, `crisis`, `motivation`, `planning`, `general`
- MI prompt feedback updates use `.update()` with manual increment (select current value, +1, update)
- No notification enum for "checkin_logged" — will use `general` type
- No database migrations needed — all tables and columns already exist

