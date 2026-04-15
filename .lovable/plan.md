

# Fix: Admin Profile Icon Not Working

## Problem
The profile icon in the admin header links to `/profile`, but that route is nested inside the participant-only `ProtectedRoute`. When an admin clicks it, they're redirected to `/login` because they don't have the `participant` role.

## Solution
Add `/admin/profile` as a route inside the admin layout that renders the same `Profile` component, and update the admin header link to point to `/admin/profile`.

### File changes

**`src/App.tsx`**
- Add route: `<Route path="/admin/profile" element={<Profile />} />` inside the admin route group

**`src/components/layouts/AdminLayout.tsx`**
- Change the profile icon `Link` from `/profile` to `/admin/profile`

### Same fix for peer specialists
The peer layout links to `/peers/profile` which renders `PeerProfile` — that already works. But we should also add a general profile route for peers if it doesn't exist. Let me check — `/peers/profile` is already in the peer route group, so peers are fine.

### Notes
- The existing `Profile.tsx` page works for any authenticated user (it reads from `participant_profiles` which may not exist for admins). We may need to make it role-aware or create a simpler admin profile page that just shows email, role, and a logout button.
- Simplest approach: create a lightweight **AdminProfilePage** that shows the admin's email, role, and a logout button — since admins don't have participant profiles.

### New file: `src/pages/AdminProfilePage.tsx`
- Shows current user email, role badge
- Logout button
- Simple card layout, consistent with admin design

### Summary of changes
1. **Create** `src/pages/AdminProfilePage.tsx` — lightweight admin profile
2. **Edit** `src/App.tsx` — add `/admin/profile` route
3. **Edit** `src/components/layouts/AdminLayout.tsx` — change profile link to `/admin/profile`

