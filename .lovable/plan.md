

# 🔵 Fix peer check-in submit error (CRPS edge function 500)

## What's broken

When you submitted the check-in, the `update-crps-competencies` edge function returned 500: `"supabaseKey is required."`

**Root cause:** The function at `supabase/functions/update-crps-competencies/index.ts` line 36 reads `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")`, but that env var does not exist inside Supabase edge functions. Only three keys are auto-injected: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. So `createClient(url, undefined)` throws.

Your check-in **did save successfully** to the DB — only the background CRPS competency update failed. But the error surfaced because the call wasn't truly fire-and-forget.

## The fix (2 small edits, no DB changes, no new files)

### 1. `supabase/functions/update-crps-competencies/index.ts`
- Replace `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")` with `Deno.env.get("SUPABASE_ANON_KEY")` on line 36 (this is the correct auto-injected env var name)
- No other changes needed — the rest of the function is fine

### 2. `src/lib/crps-updater.ts`
- Make it truly fire-and-forget by also catching synchronous throws from `supabase.functions.invoke` (currently the `.catch()` only catches async rejections). Wrap the invoke in a `try`/`catch` that swallows the error and only `console.warn`s it.
- This guarantees that even if the edge function 500s, the user never sees a runtime error toast — the check-in / note / milestone submit completes cleanly.

## What you'll see after the fix

- 🔵 Peer logs check-in → "Check-in saved" toast → no error
- 🔵 Peer logs progress note → saves cleanly → no error
- 👑 Admin actions that touch CRPS → no error
- CRPS competencies actually start advancing (MI / Documentation tools move from `not_started` → `in_progress`) — they weren't updating before because every call was failing

## Verification

Log in as a peer specialist → `/caseload` → tap any participant's `…` menu → "Log check-in" → fill out and submit. Confirm the success toast appears with no red error.

