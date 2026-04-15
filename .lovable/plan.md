

# Plan: Fix /admin Page Not Resolving (Infinite Loading Spinner)

## Problem

When visiting `/admin`, the page shows an infinite loading spinner. The `AuthContext.fetchUserRole` function silently swallows database query errors — if the query to the `users` table fails, `role` stays `null` and `loading` is never set to `false` (in the `onAuthStateChange` path), leaving the UI stuck forever.

## Root cause

In `src/contexts/AuthContext.tsx`, line 74:
```ts
setTimeout(() => fetchUserRole(newSession.user.id), 0);
```
This deferred call has no `.finally(() => setLoading(false))` — only the initial `getSession` path (line 87) calls `setLoading(false)`. If `onAuthStateChange` fires first (common), loading never resolves when the query fails.

Additionally, `fetchUserRole` (line 35-55) doesn't handle errors — if the `users` query fails, `role` stays `null`, and the `ProtectedRoute` shows a permanent spinner (line 75-79).

## Fix (single file)

**`src/contexts/AuthContext.tsx`**:
1. Add error handling to `fetchUserRole` — if the query fails, still set `loading = false` and show a toast or log
2. Ensure `setLoading(false)` is called in the `onAuthStateChange` path after `fetchUserRole` completes (success or failure)
3. In `ProtectedRoute.tsx` — if `role` is `null` after loading completes, redirect to `/login` instead of showing a permanent spinner (line 75-79)

**`src/components/ProtectedRoute.tsx`**:
- Change the `!role` block (lines 75-79) from a spinner to a redirect to `/login`, since if loading is done and role is still null, something went wrong

## No database changes needed

