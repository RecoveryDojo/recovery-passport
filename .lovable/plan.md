
The user expects the "Pending Requests" tab to show participants needing peer assignment. But `peer_requests` only contains rows when a **participant explicitly requests a specific peer specialist** from the Peer Browse page. The query is correct (returns `[]` because no participants have submitted requests), but the UX expectation is different: admins want to assign peers to **any unassigned participant**, not just those who requested one.

Looking at the data:
- 14 participants total, only 1 has `assigned_peer_id` set
- 0 rows in `peer_requests` with status='pending'
- Admin sees empty Pending Requests tab and concludes the page is broken

## Plan: Add admin-initiated assignment

Rework the Admin Participants page so admins can assign any unassigned participant to any approved peer specialist directly — without waiting for a participant-initiated request.

### Changes to `src/pages/AdminParticipantsPage.tsx`

**Tab 1 — rename to "Needs Assignment"** (replaces "Pending Requests")
- Query: all `participant_profiles` where `assigned_peer_id IS NULL` AND `deleted_at IS NULL`
- Also fetch any `peer_requests` with status='pending' to show "Requested: [Peer Name]" hint inline when present
- Each row shows:
  - Participant name + email
  - Days in recovery
  - If they have a pending peer_request: badge "Requested [Peer Name]" + "Approve Request" button (one-click assign that peer)
  - "Assign Peer" dropdown listing all approved peer specialists (`approval_status='approved'`)
  - On selection: update `participant_profiles.assigned_peer_id`, mark any pending peer_request as approved, log audit, notify participant

**Tab 2 — "All Participants"** (unchanged structure)
- Add a "Reassign" / "Change Peer" dropdown on each row so admins can change assignments anytime
- Keep the assigned/unassigned badge

**Mutation logic for assignment:**
1. UPDATE `participant_profiles` SET `assigned_peer_id` = selected peer
2. If a pending `peer_requests` row exists for that participant → UPDATE status='approved', responded_at=now()
3. INSERT into `audit_log` (action: 'assign_peer')
4. INSERT into `notifications` for participant

### Tab counts
- "Needs Assignment (13)" — count of unassigned participants  
- "All Participants (14)" — total

### No DB changes needed
RLS already allows admin updates on both tables. No migration required.

### Files
- `src/pages/AdminParticipantsPage.tsx` — rework Tab 1 query + add assignment dropdowns to both tabs
