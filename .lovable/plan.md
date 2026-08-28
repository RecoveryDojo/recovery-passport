# Why the Content Hub shows "Coming soon"

## Verified findings

- Current source routes `/admin/content` to `AdminContentHubPage` (the 11-tile hub). The old `AdminContent` placeholder still exists in `src/pages/placeholder-pages.tsx` and is still imported in `App.tsx`, but it is not attached to any route.
- The **live published bundle is already correct**: the JS served at the custom domain contains "Content Hub" three times and contains the string "Coming soon" zero times. The placeholder is not in the deployed build at all.
- The deployed service worker is current and does call `skipWaiting()` / `clientsClaim()`, and precaches `index.html` with a navigation fallback.

Conclusion: the screen in the screenshot cannot be produced by the code that is deployed today. It is an **older bundle being served out of the browser's service-worker cache** (workbox serves the precached `index.html`, which points at the old hashed JS). A new SW only takes control after the SW script is re-fetched, so a session that started on the old worker keeps rendering the old app until reload.

## Alternative causes considered and ruled out

- **Not deployed yet** — ruled out; the published bundle has the hub.
- **Route mis-wired / duplicate route** — ruled out; `/admin/content` is declared once and points at the hub.
- **Nav link pointing at the wrong path** — ruled out; the sidebar item is `/admin/content`.
- **Role gating hiding the page** — ruled out; a role failure redirects or shows a spinner, it does not render a "Coming soon" placeholder.
- **Runtime error in the hub page** — ruled out; a crash produces a blank screen or error boundary, not this placeholder.
- **Data/RLS problem** — ruled out; the hub tiles are static links, they read nothing from the database.

## Fix

1. Delete the dead `AdminContent` placeholder (and the other unused placeholder exports that shadow real pages, e.g. `CardPage`, `PlanPage`, `CrpsPage`, `CaseloadPage`, `AdminDashboard`, `AdminParticipants`, `AdminReports`, `AdminAudit`, `IntakePage`) plus the unused import in `App.tsx`, so no stale screen can ever be built again.
2. Add explicit service-worker update handling in `src/main.tsx` using `virtual:pwa-register`: on `onNeedRefresh`, immediately activate the new worker and reload, so admins can never be pinned to an old bundle.
3. Republish, then verify `/admin/content` renders the tiles in a fresh session.

## Immediate workaround (no code needed, works right now)

Hard-reload the tab (Ctrl/Cmd + Shift + R), or DevTools > Application > Service Workers > Unregister, then reload. If the app was installed to the home screen, fully close and reopen it.

## Technical notes

- Files touched: `src/pages/placeholder-pages.tsx`, `src/App.tsx`, `src/main.tsx`.
- No database, RLS, or edge-function changes. This is a client caching issue only.
