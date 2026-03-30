

# Prompt 1: Auth + Role Routing + Navigation Shells

## Overview
Build the complete authentication system, role-based routing, and navigation shells for all three user roles. This is the app's foundation.

## Files to Create/Modify

### 1. Update CSS variables (`src/index.css`)
Replace default shadcn colors with the Recovery Passport palette:
- `--primary`: deep teal #1A4A4A (converted to HSL: ~180 47% 20%)
- `--accent`: warm amber #C5792A (HSL: ~30 65% 47%)
- `--background`: cream #FAF5EC (HSL: ~37 65% 96%)
- `--card`: white #FFFFFF
- `--foreground`: dark teal for text
- Add `--amber` custom property for accent usage

### 2. Auth context (`src/contexts/AuthContext.tsx`)
- `AuthProvider` wrapping the app
- `onAuthStateChange` listener set up BEFORE `getSession()` call
- After auth state resolves, fetch user role from `users` table
- For `peer_specialist`, also fetch `approval_status` from `peer_specialist_profiles`
- Expose: `user`, `role`, `approvalStatus`, `loading`, `signOut`

### 3. Auth pages
- **`src/pages/Login.tsx`** — email + password form, centered card on cream background, "Recovery Passport" wordmark at top, "Walk-in intake? Start here" link to `/intake`, "Forgot password?" link, "Create account" link to `/signup`
- **`src/pages/Signup.tsx`** — email, password, role selector (Participant / Peer Specialist radio buttons), signup via `supabase.auth.signUp` passing `{ data: { role } }` in metadata so the `handle_new_user` trigger creates the correct rows
- **`src/pages/ResetPassword.tsx`** — email input, calls `resetPasswordForEmail` with redirect to `/reset-password`
- **`src/pages/UpdatePassword.tsx`** — mounted at `/reset-password`, checks for `type=recovery` in URL hash, form to set new password via `updateUser`

### 4. Protected route wrapper (`src/components/ProtectedRoute.tsx`)
- If not authenticated, redirect to `/login`
- If loading, show spinner
- If role doesn't match allowed roles, redirect to role's home
- Special case: `peer_specialist` with `approval_status !== 'approved'` shows the pending approval holding page

### 5. Peer pending page (`src/components/PeerPendingApproval.tsx`)
- Full-screen cream background
- Message: "Your account is pending approval from your supervisor. You'll receive a notification when you're approved."
- Sign out button

### 6. Navigation layouts
- **`src/components/layouts/ParticipantLayout.tsx`** — bottom nav bar with 4 items: My Card (Home), My Plan (ClipboardList), Resources (MapPin), Passport (QrCode). Content area above nav.
- **`src/components/layouts/PeerLayout.tsx`** — bottom nav bar with 3 items: Caseload (Users), Check-Ins (CheckCircle), My Progress (BarChart3).
- **`src/components/layouts/AdminLayout.tsx`** — sidebar on desktop using shadcn Sidebar component, bottom nav on mobile. 6 items: Dashboard (LayoutGrid), Participants (Users), Peer Specialists (UserCheck), Content (BookOpen), Reports (BarChart2), Audit Log (Clock).

### 7. Placeholder pages (11 total)
Each is a simple centered page with the page title in teal on cream background:
- Participant: `CardPage`, `PlanPage`, `ResourcesPage`, `PassportPage`
- Peer: `CaseloadPage`, `CheckInsPage`, `CrpsPage`
- Admin: `AdminDashboard`, `AdminParticipants`, `AdminPeers`, `AdminContent`, `AdminReports`, `AdminAudit`

### 8. Update `src/App.tsx`
- Wrap with `AuthProvider`
- Public routes: `/login`, `/signup`, `/reset-password`, `/forgot-password`
- Protected routes grouped by role, each wrapped in their layout component
- Index route `/` redirects to role-appropriate home

## Technical Details

**Signup metadata pattern:**
```typescript
supabase.auth.signUp({
  email,
  password,
  options: { data: { role: selectedRole } }
})
```
The `handle_new_user` trigger reads `raw_user_meta_data->>'role'` to create the correct profile row.

**Role fetch after login:**
```typescript
const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
```

**Peer approval check:**
```typescript
const { data } = await supabase.from('peer_specialist_profiles').select('approval_status').eq('user_id', user.id).single();
```

**Auto-confirm:** Will NOT be enabled. Users must verify email before signing in.

**Route structure:**
```text
/login, /signup, /forgot-password, /reset-password  (public)
/card, /plan, /resources, /passport                  (participant)
/caseload, /checkins, /crps                          (peer_specialist)
/admin, /admin/participants, /admin/peers,            (admin)
/admin/content, /admin/reports, /admin/audit
/intake                                               (public, placeholder)
```

