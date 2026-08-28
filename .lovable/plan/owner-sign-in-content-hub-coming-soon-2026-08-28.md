# Owner sign-in + Content Hub "Coming soon"

## 1. Get you into the owner account

Set a temporary password on `scotticainc@gmail.com` using an admin-level auth call (Lovable Cloud user admin), then give it to you in chat.

- You sign in at `/login` with that temp password.
- Change it immediately from your profile page (or via Forgot password) — treat the temp value as burned once used.
- No other account is touched; the owner-admin protections stay in place.

## 2. Why the Content Hub shows "Coming soon"

Verified findings:

- Current source routes `/admin/content` to `AdminContentHubPage` (the 11-tile hub). The old `AdminContent` placeholder still exists in `src/pages/placeholder-pages.tsx` and is imported in `App.tsx`, but is not attached to any route.
- The live published bundle is already correct: the served JS contains "Content Hub" and contains "Coming soon" zero times.
- The deployed service worker is current and does call `skipWaiting()` / `clientsClaim()`.

So the screen in the screenshot cannot come from deployed code. It is an **older bundle served from the browser's service-worker cache** (workbox serves precached `index.html`, which points at the old hashed JS).

Ruled out: not deployed, duplicate/mis-wired route, wrong nav link, role gating, runtime crash, and any database/RLS cause (the tiles are static links and read nothing).

### Fix

1. Delete the dead placeholder exports in `src/pages/placeholder-pages.tsx` (`AdminContent`, plus the unused ones shadowing real pages: `CardPage`, `PlanPage`, `CrpsPage`, `CaseloadPage`, `AdminDashboard`, `AdminParticipants`, `AdminReports`, `AdminAudit`, `IntakePage`) and remove the unused import in `App.tsx`.
2. Add service-worker update handling in `src/main.tsx` via `virtual:pwa-register`: on `onNeedRefresh`, activate the new worker and reload, so nobody gets pinned to an old bundle again.
3. Republish and verify `/admin/content` renders the tiles in a fresh session.

### Works right now, no code

Hard-reload the tab (Ctrl/Cmd + Shift + R), or DevTools > Application > Service Workers > Unregister, then reload.

## Technical notes

- Files touched: `src/pages/placeholder-pages.tsx`, `src/App.tsx`, `src/main.tsx`.
- No database, RLS, or edge-function changes. The password reset is an auth admin operation, not a schema change.
