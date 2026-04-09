

# Plan: Elevate scott@iopinabox.com to Admin + Fix Build Errors

## 1. Elevate user to admin
Run an UPDATE on the `users` table to set `role = 'admin'` for `scott@iopinabox.com`. The user will need to log out and back in for the role change to take effect.

## 2. Fix 3 TypeScript build errors
All three errors are the same pattern: using `Record<string, unknown>` or `Record<string, number>` for Supabase `.update()` calls, which the strict Supabase types reject. The fix is to replace the generic `Record` types with properly typed objects.

**Files to fix:**

- **AdminPeersPage.tsx (line 84)**: Change `Record<string, unknown>` to an inline typed object built conditionally with spread syntax
- **PeerProfile.tsx (line 137)**: Same pattern — replace `Record<string, unknown>` with a properly typed object
- **CheckInFormPage.tsx (line 114)**: Change `Record<string, number>` to a typed object matching the `mi_prompts` update shape

Each fix replaces the loosely-typed object with explicit property assignments so TypeScript can verify the shape matches the Supabase table schema.

