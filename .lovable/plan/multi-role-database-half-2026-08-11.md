# Multi-Role: Database Half

## What already shipped
The front-end multi-role work is done and live:
- `AuthContext` exposes `roles` (array), `activeRole`, and `setActiveRole`, persisted across reloads.
- It already tries to read from a `user_roles` table and falls back to the single `users.role` when that table is absent.
- `RoleSwitcher` pill is wired into the admin, peer, and participant layouts, and hides itself for single-role users.
- `ProtectedRoute`, `RoleRedirect`, and login redirect all use `activeRole`.

## What is missing (verified)
There is no `user_roles` table in the database. Every user still has exactly one role in `public.users.role`, so the switcher never appears and Will cannot be both peer specialist and admin.

## What this plan does
Add the role table so multiple roles per person become real, without breaking any of the ~60 existing access rules.

### 1. New `user_roles` table
- One row per user-plus-role pair, so a person can hold several.
- Only admins can grant or remove roles. Users can read their own roles.
- Backfill: copy every existing `users.role` value in, so nothing changes for current users on day one.

### 2. Keep existing access rules working
- `get_user_role()` stays but is rewritten to return the user's highest role from the new table (admin, then peer specialist, then participant). Every existing policy keeps working unchanged.
- Add a `has_role(user_id, role)` helper for any policy that should accept any of a user's roles rather than just the top one.
- `users.role` is kept in sync as the person's primary role so nothing that reads it breaks.

### 3. Signup and promotion stay locked down
- The signup trigger writes the new row as participant or peer specialist only — never admin.
- The last-admin protection carries over to the new table.
- Admin promotion still happens only through the admin users panel.

### 4. Admin users panel
- Replace the single-role dropdown with role checkboxes (Participant, Peer Specialist, Admin).
- Saving writes to `user_roles`; removing the last admin is blocked with a clear message.

### 5. Profile side-effects
- Granting someone the peer specialist role creates their peer profile if missing (pending approval), matching today's signup behavior.
- Granting participant creates a participant profile if missing.

## Result
Will gets both peer specialist and admin, sees the "Viewing as" pill, and toggles between `/caseload` and `/admin`. Single-role users see zero change.

## Technical notes
- `user_roles(id, user_id, role app_role, granted_by, created_at)` with a unique constraint on `(user_id, role)`, GRANTs for authenticated and service_role, RLS enabled.
- `has_role` and the rewritten `get_user_role` are `SECURITY DEFINER STABLE` with `search_path = public` to avoid recursive RLS.
- A trigger keeps `users.role` equal to the highest role in `user_roles` after any insert or delete.
- Once the table exists, the existing `AuthContext` code path picks it up with no front-end change required.
