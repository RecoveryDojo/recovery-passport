

## Fix: Peer specialists cannot delete plan action steps

### Problem
The `plan_action_steps` table has **no DELETE RLS policy**. When the peer specialist clicks "Remove" on a step, the Supabase `.delete()` call silently fails due to RLS, but the toast still shows "Step removed" because the audit log insert succeeds first (and the delete error isn't properly surfaced since Supabase returns no error for 0-row deletes).

### Solution
Add a DELETE RLS policy on `plan_action_steps` allowing peer specialists and admins to delete steps.

### Steps

1. **Database migration** — Add DELETE policy:
```sql
CREATE POLICY "Steps: peer delete"
ON public.plan_action_steps
FOR DELETE
TO public
USING (
  get_user_role() = ANY(ARRAY['peer_specialist'::user_role, 'admin'::user_role])
);
```

2. **Fix delete mutation order in `PeerPlanTab.tsx`** — Move the audit log insert AFTER the delete, and check for errors properly. Currently audit is inserted first (line 204) before the delete (line 211). If delete fails, we still get an audit entry. Reorder to: delete first, then audit on success.

### Regarding completed steps
Per the prompt spec, peer specialists should be able to delete any step regardless of completion status. The delete wasn't working for *any* step — completed or not — due to the missing RLS policy.

