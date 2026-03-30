

## Bug Fix: Peer Approval Gate Blocking `/peers/setup`

**Problem**: Line 86-88 checks `approvalStatus !== "approved"` unconditionally for all peer specialists, including those on `/peers/setup` with `skipProfileCheck=true`. Since `skipProfileCheck` marks `peerProfileCheck` as `"complete"` (line 18-19, 28-29), the incomplete profile redirect on line 82 is skipped, and the approval gate on line 86 fires immediately.

**Fix**: Two changes.

### 1. `src/components/ProtectedRoute.tsx`

- **Always run the peer profile query** for `peer_specialist` role, regardless of `skipProfileCheck`. Remove the early return on line 23-31 for peer specialists so `peerProfileCheck` reflects the real DB state.
- **Gate the approval check** behind profile completeness: change line 86 from:
  ```
  if (role === "peer_specialist" && approvalStatus !== "approved")
  ```
  to:
  ```
  if (role === "peer_specialist" && peerProfileCheck === "complete" && approvalStatus !== "approved")
  ```
- Keep the profile-incomplete redirect on line 82 but **remove the `!skipProfileCheck` guard** so it always fires when the profile is actually incomplete:
  ```
  if (role === "peer_specialist" && peerProfileCheck === "incomplete")
  ```

### 2. `src/App.tsx`

- Remove `skipProfileCheck` from the `/peers/setup` route since it's no longer needed — the profile completeness check itself gates access.

### Result
- New peer with empty profile → query returns incomplete → redirect to `/peers/setup` (approval gate never reached)
- Peer completes profile → query returns complete → approval gate fires → pending screen
- Approved peer → passes through to `/caseload`

No database changes.

