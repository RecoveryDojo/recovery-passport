CREATE POLICY "Steps: peer delete"
ON public.plan_action_steps
FOR DELETE
TO public
USING (
  get_user_role() = ANY(ARRAY['peer_specialist'::user_role, 'admin'::user_role])
);