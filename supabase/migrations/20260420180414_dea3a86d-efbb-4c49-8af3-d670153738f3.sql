-- Phase 2A: allow participant self-mood logging into weekly_checkins
-- 1. Make peer_specialist_id nullable so a participant can log mood without a peer attached.
ALTER TABLE public.weekly_checkins
  ALTER COLUMN peer_specialist_id DROP NOT NULL;

-- 2. Replace the peer-only INSERT policy with one that also allows a participant to insert
--    a check-in for themselves. Reads + behavior for peer/admin remain unchanged.
DROP POLICY IF EXISTS "Checkins: peer create" ON public.weekly_checkins;
CREATE POLICY "Checkins: insert"
ON public.weekly_checkins
FOR INSERT
WITH CHECK (
  is_assigned_peer(participant_id)
  OR get_user_role() = 'admin'::user_role
  OR participant_id = get_participant_profile_id()
);
