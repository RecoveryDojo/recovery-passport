CREATE POLICY "Assigned peer reads participant demographics"
  ON public.participant_demographics
  FOR SELECT
  TO authenticated
  USING (
    (get_user_role() = 'peer_specialist'::user_role)
    AND public.is_assigned_peer(participant_id)
  );