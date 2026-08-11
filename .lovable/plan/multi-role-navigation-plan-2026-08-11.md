# Multi-Role Navigation Plan

## Goal
Let users with multiple roles move between role-based views without confusion, and always know which "hat" they're wearing.

## Background
The app currently stores one role in `public.users.role` and routes every login to a single home screen. With admin-only promotion now possible, people like Will need to be both peer_specialist and admin. The UI must make that switch obvious and safe.

## Scope
- Front-end only: auth context, layout, navigation, and route guards.
- No database or RLS changes in this plan. Server-side permissions remain the union of the user's roles; switching only changes what the UI shows and which routes are reachable.

## Technical Plan

### 1. AuthContext upgrades
- Load the user's full role set from `public.users.role` (and later from `user_roles` if multi-role is implemented there).
- Track an `activeRole` state, defaulting to the most privileged role in the set (admin → peer_specialist → participant).
- Persist `activeRole` in `localStorage` so it survives reloads.
- Expose `setActiveRole`, `roles`, and `activeRole` to consumers.

### 2. Role switcher UI
- Add a persistent pill at the top of the sidebar / bottom nav that reads:
  - "Viewing as: Admin ▾"
  - "Viewing as: Peer Specialist ▾"
  - "Viewing as: Participant ▾"
- Clicking it opens a small menu with the other roles the user has.
- Switching reloads the layout and routes for that role.
- If the user is only in one role, hide the pill.

### 3. Layout and route guards
- `RoleRedirect` and `ProtectedRoute` use `activeRole` instead of the single role.
- Each role keeps its existing home route: admin → /admin, peer_specialist → /caseload, participant → /card.
- Role-specific side/bottom nav stays the same per role, but now swaps when the active role swaps.
- Unauthorized routes show the existing fallback (e.g., a "Not available in this view" page or redirect home).

### 4. Sign-in landing
- After login, the user lands on the home of their default (most privileged) role.
- A toast or inline notice says: "You're signed in as Admin. Switch views from the top menu."

### 5. Edge cases
- Deep-link to a route that doesn't belong to the active role: either redirect to that role's home or prompt to switch.
- Active role stored in `localStorage` is invalid or removed: fall back to most privileged role.
- Single-role users: switcher is invisible; experience unchanged.

## Out of scope
- Full multi-role database migration (`user_roles` table). The plan assumes a single role string today, but designs the switcher so it can later read from a role array.
- RLS changes. Server-side permissions remain the union of all roles the user holds.
- Changes to admin-promotion flow or sign-up role restrictions.

## Design direction
- Always-visible pill. Warm, non-clinical. Teal/amber for participant/peer, purple/gold accents for admin to match the REF donor brand when in admin mode.
- Clear active state, subtle hover, fast transition.

## Success criteria
- Will can log in as peer + admin, see the switcher, toggle between /caseload and /admin, and never get stuck on a route meant for the wrong role.
- Single-role users see no change.
- No regression in existing routing, RLS, or mobile nav.
