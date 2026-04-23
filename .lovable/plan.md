
## Goal
Make the floating dev role switcher always visible, including when logged in as **admin** and when the mobile bottom navigation is showing.

## Why it's hidden today
- The button is positioned `fixed bottom-4 right-4` with `z-[9999]`.
- The mobile bottom nav (admin / participant / peer layouts) is `fixed bottom-0` `h-16` with `z-50`.
- That puts the switcher *inside the bottom nav's footprint* on mobile widths — the wrench sits underneath the nav bar and reads as invisible/untappable.
- The role check itself is fine: it already shows for any authenticated user on `lovable.app` or `localhost`, including admin.

## Change (one file only)

**File:** `src/components/DevRoleSwitcher.tsx`

1. **Lift above the mobile bottom nav.**
   - Change container from `fixed bottom-4 right-4 z-[9999]` to `fixed bottom-20 right-4 md:bottom-4 z-[10000]`.
   - On mobile (`< md`), it sits above the 64px tall bottom nav.
   - On desktop, it returns to the corner.

2. **Bump z-index.**
   - From `z-[9999]` to `z-[10000]` so it always renders above sonner toasts and other overlays.

3. **Add a current-role badge to the trigger.**
   - Resolve current role to its emoji (`🎴` participant, `🤝` peer, `🛡️` admin).
   - Replace the plain wrench circle with a small pill: `🔧` + current role emoji.
   - Slightly larger (`h-12 px-3`) so it's easier to spot and tap.

## What does NOT change
- No DB changes.
- No auth/role logic changes — admins can already switch.
- No layout changes to admin/participant/peer pages.
- The dev/preview gate (`lovable.app` / `localhost` / `import.meta.env.DEV`) is unchanged.

## Verification
1. Log in as admin → wrench pill visible bottom-right with `🔧 🛡️`.
2. Resize to mobile width (375px) → wrench sits above the admin bottom nav, not behind it.
3. Tap wrench → menu shows Participant / Peer / Admin with Admin highlighted as current.
4. Tap Participant → role updates, page reloads, lands on `/card`.
5. Tap wrench again as participant on mobile → still visible above the participant bottom nav.
6. Repeat as peer specialist → same behavior.
