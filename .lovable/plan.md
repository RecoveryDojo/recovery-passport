

## Add Notification Bell to Participant Layout

### Problem
Participants have no way to view their notifications. The layout queries `unreadCount` but only shows a tiny dot on the nav bar — no bell icon, no dropdown, no way to read notification content.

### Solution
Add the same notification bell + dropdown pattern from `PeerLayout` into `ParticipantLayout`'s header area.

### Changes

**1. Update `src/components/layouts/ParticipantLayout.tsx`**
- Add a sticky header bar (matching PeerLayout pattern) with "Recovery Passport" title and a bell icon button
- Add notification dropdown with unread badge, list of recent notifications, and mark-as-read on open
- Wire up realtime subscription for live notification updates
- Keep the existing bottom nav bar unchanged

The implementation mirrors the PeerLayout notification system: bell icon with unread count badge, dropdown panel showing recent notifications with title/body/timestamp, and realtime updates via Supabase channel subscription.

