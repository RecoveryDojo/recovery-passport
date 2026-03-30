

# Prompt 13: Participant Milestone View + Card Updates

## What already exists
- **CardPage.tsx**: Already has realtime subscription on `participant_profiles` for card_level changes, level-up celebration with toast + notification insert, milestone stats query, recent milestones list, and a "View All Milestones" link to `/milestones`.
- **ParticipantLayout.tsx**: Bottom nav with 5 tabs. No notification badge yet.
- **No `/milestones` route** exists for participants.

## What needs to be built

### 1. Create `/milestones` page (`src/pages/ParticipantMilestonesPage.tsx`)
- Query all active `milestone_definitions` ordered by `sort_order`
- Query `participant_milestones` for this participant, joining `peer_specialist_profiles` on `unlocked_by` for the verifier name
- For each milestone:
  - **Earned**: Green check, bold name, "Verified by [name] on [date]", optional note in gray italic
  - **Not earned**: Gray lock icon, name in gray, description in smaller text
- No unlock button — read-only for participants
- Back link to `/card`

### 2. Make milestone stat tappable on CardPage
- Wrap the Milestones `StatBox` in a `Link` to `/milestones` with a cursor-pointer style

### 3. Add realtime subscription for `participant_milestones`
- CardPage already subscribes to `participant_profiles` changes. Add a second channel on `participant_milestones` filtered by `participant_id` to auto-invalidate milestone stats and recent milestones queries when a new row is inserted.

### 4. Notification badge on "My Card" nav tab
- In `ParticipantLayout`, query unread notifications count (`is_read = false`) for the current user
- Show a red badge dot on the "My Card" tab icon when count > 0
- Show a dismissible banner at top of CardPage: "You have [N] new milestones!" tappable to navigate to `/milestones`
- The banner filters specifically for unread `milestone_unlocked` notifications

### 5. Register route
- Add `/milestones` route inside the participant layout in `App.tsx`

## Technical details

### Files to create
- `src/pages/ParticipantMilestonesPage.tsx`

### Files to modify
- `src/pages/CardPage.tsx` — make milestone stat tappable, add realtime channel for `participant_milestones`, add unread milestone banner
- `src/components/layouts/ParticipantLayout.tsx` — add notification badge on My Card tab
- `src/App.tsx` — add `/milestones` route

### Realtime channels (CardPage)
```typescript
// Existing: participant_profiles channel (card_level changes)
// New: participant_milestones channel
supabase.channel(`milestones-${profile.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'participant_milestones',
    filter: `participant_id=eq.${profile.id}`,
  }, () => {
    queryClient.invalidateQueries({ queryKey: ["milestone-stats", profile.id] });
    queryClient.invalidateQueries({ queryKey: ["recent-milestones", profile.id] });
  })
  .subscribe();
```

### Notification badge (ParticipantLayout)
```typescript
const { data: unreadCount } = useQuery({
  queryKey: ["unread-notifications", user?.id],
  queryFn: async () => {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("is_read", false);
    return count ?? 0;
  },
});
// Render red dot on My Card icon when unreadCount > 0
```

