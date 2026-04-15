

# Plan: Admin User Management Page with Role Editing

## What gets built

A new **Admin Users** page accessible from the admin sidebar, showing all users in a searchable/filterable table with their email, role, and join date. Admins can change any user's role via a dropdown.

## Database change (migration required)

The current `users` table RLS only allows users to update **their own** row. We need a new UPDATE policy so admins can change other users' roles:

```sql
CREATE POLICY "Admin can update any user"
ON public.users
FOR UPDATE
TO authenticated
USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);
```

## New file: `src/pages/AdminUsersPage.tsx`

- Fetches all rows from `users` table (admin RLS already allows SELECT on all)
- Displays a table: Email, Role (badge), Joined date
- Search/filter by email or role
- Each row has a role dropdown (participant / peer_specialist / admin) that updates via `supabase.from("users").update({ role }).eq("id", userId)`
- Confirmation dialog before changing roles to prevent accidents
- Toast on success/failure

## Modified file: `src/App.tsx`

- Add route: `/admin/users` → `AdminUsersPage`

## Modified file: `src/components/layouts/AdminLayout.tsx`

- Add "Users" nav item with a `Shield` icon between Dashboard and Participants

## Technical notes

- No new tables or columns needed
- The `users` table already stores role as `user_role` enum (participant, peer_specialist, admin)
- Changing role here updates the `users` table only — profile tables (participant_profiles, peer_specialist_profiles) are created at signup and remain as-is
- Admin should not be able to remove their own admin role (safety guard)

