# Why the Content Hub shows "Coming soon"

## What's actually happening

The current code routes `/admin/content` to the real Content Hub page (`AdminContentHubPage`), which renders the 11 tiles (Programs, Milestones, Assessment Rubric, Assessment Library, MI Prompts, Plan Templates, Note Templates, Crisis Protocol, Agreements, Intake Forms, Resources).

The "Content / Coming soon" screen in the screenshot comes from an old placeholder component (`AdminContent` in `src/pages/placeholder-pages.tsx`). That component is still imported in `App.tsx` but is no longer attached to any route. So the screen being displayed is coming from a **stale build in the browser**, not from current code.

The app is a PWA with `registerType: "autoUpdate"` and a workbox service worker that caches app shell and routes. A previously installed service worker will keep serving the old bundle until it updates — which is the most likely reason an older version of the Content page is still on screen.

## Fix

1. Delete the dead `AdminContent` placeholder export and its unused import in `App.tsx`, so the old screen can no longer be built or served from any code path.
2. Add an explicit update path for the service worker: register an update handler that detects a new build and prompts/reloads, so the admin panel can't get pinned to an old bundle again.
3. Republish so the hosted build matches current code.
4. Verify `/admin/content` renders the tiles in a fresh session.

## Immediate workaround (no code needed)

Hard-reload the tab (Ctrl/Cmd + Shift + R), or open DevTools > Application > Service Workers > Unregister, then reload. If the app was installed to the home screen, close and reopen it after that.

## Technical notes

- Files touched: `src/pages/placeholder-pages.tsx` (remove `AdminContent`), `src/App.tsx` (remove unused import), `src/main.tsx` (service-worker update handling).
- No database or RLS changes; this is a build/caching issue, not a permissions one.
