# Lock down admin: nobody can self-assign it

Two real privilege-escalation holes exist today. Both let a determined user become an admin without anyone approving it.

## What's broken (verified)

1. **Signup trusts whatever role the client sends.** The signup trigger reads the role out of the sign-up payload and writes it straight into the user record. The app's own signup screen only offers participant and peer specialist, but anyone calling the API directly can send `admin` and be an admin the moment they confirm their email.

2. **Any signed-in user can rewrite their own role.** The "users can update own row" rule has no restriction on *what* they may change, so a user can flip their own row to `admin` from the browser. Admin promotion is supposed to be admin-only (that rule exists too), but the self-update rule overrides the intent.

## The fix

**Signup can only ever produce participant or peer specialist.**
Change the signup trigger so any requested role other than those two silently becomes `participant`. Admin is never reachable through signup, no matter what the client sends.

**Self-service edits can't touch role.**
Replace the self-update rule so a user updating their own row must keep their role exactly as it already is. They can still update their own email/phone. Only the existing admin-only rule can change a role.

**Admins can't demote themselves into a lockout.**
Add a guard so the last remaining admin cannot be changed away from admin — protects against locking the whole org out of the admin panel.

**Admin UI stays as-is** (`/admin/users` already has the role selector and confirmation dialog). Add one small touch: an admin cannot change their own role from that screen, so the change has to come from another admin.

## Technical notes

- Update `public.handle_new_user()` to coerce the metadata role: keep only `participant` and `peer_specialist`, fall back to `participant`.
- Drop and recreate the `Users can update own row` UPDATE policy on `public.users` with a `WITH CHECK` requiring `id = auth.uid() AND role = (SELECT role FROM public.users WHERE id = auth.uid())` — role must be unchanged. Keep `Admin can update any user` untouched.
- Add a `BEFORE UPDATE` trigger on `public.users` raising an exception when the update would leave zero admins.
- `src/pages/AdminUsersPage.tsx`: disable the role selector on the current admin's own row with a short tooltip.

## Out of scope

Multi-role support (a user being both peer and admin) is a separate, larger change and is not part of this plan.
