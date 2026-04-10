

# Plan: Add Peer Profile Detail Review for Admin Approval

## Problem
Currently, admins can only see a peer's name, status badge, specialties, and caseload count on the list. The Approve/Reject buttons are right on the list card with no way to drill into the full profile details (bio, photo, specialties, availability) before making an approval decision.

## What gets built

A clickable peer name/card on the `AdminPeersPage` that opens a **detail review sheet** (slide-over panel) showing the peer's complete submitted profile before the admin approves or rejects.

### Detail review panel contents
- **Photo** (full size avatar)
- **Full name**
- **Bio** (full text)
- **Specialties** (all tags)
- **Availability** status
- **CRPS status**
- **Account created date**
- **Caseload count**
- **Approval status** badge
- **Approve / Reject buttons** at the bottom (for pending peers)

### How it works
1. Admin clicks the peer's name or an "eye" icon on any peer card
2. A `Sheet` (side panel) opens showing full profile details — all fields the peer submitted
3. For pending peers, Approve and Reject buttons appear at the bottom of the sheet
4. Reject opens the existing rejection reason dialog
5. Approving from the sheet uses the existing `updateStatus` mutation

### Files modified

**`src/pages/AdminPeersPage.tsx`** — Single file change:
- Add a `detailPeer` state (reuse the existing `PeerProfile` type)
- Make the peer name/avatar clickable → sets `detailPeer`
- Add a new `Sheet` component showing full profile fields
- Include Approve/Reject buttons inside the sheet for pending peers
- Reuse existing mutations (no new queries needed — all data is already fetched)

No new files, no new routes, no database changes.

