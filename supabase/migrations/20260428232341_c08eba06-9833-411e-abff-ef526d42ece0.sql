-- Allow peer specialists to set themselves as assigned_peer_id on a participant_profiles row
-- ONLY when that participant has a pending peer_request directed at them. This is required for
-- the "Approve request" flow on the caseload page.

CREATE POLICY "Peer can self-assign on approved request"
ON public.participant_profiles
FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'peer_specialist'
  AND EXISTS (
    SELECT 1 FROM public.peer_requests pr
    WHERE pr.participant_id = participant_profiles.id
      AND pr.peer_specialist_id = auth.uid()
  )
)
WITH CHECK (
  get_user_role() = 'peer_specialist'
  AND assigned_peer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.peer_requests pr
    WHERE pr.participant_id = participant_profiles.id
      AND pr.peer_specialist_id = auth.uid()
  )
);