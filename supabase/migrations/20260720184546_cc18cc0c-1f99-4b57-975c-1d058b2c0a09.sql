
-- Tighten assessment_scores INSERT
DROP POLICY IF EXISTS "Assessment scores: create" ON public.assessment_scores;
CREATE POLICY "Assessment scores: create" ON public.assessment_scores
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.id = assessment_scores.session_id
      AND (
        s.participant_id = get_participant_profile_id()
        OR s.initiated_by = auth.uid()
        OR is_assigned_peer(s.participant_id)
        OR get_user_role() = 'admin'::user_role
      )
  )
);

-- Tighten plan_action_steps SELECT and UPDATE
DROP POLICY IF EXISTS "Steps: read" ON public.plan_action_steps;
CREATE POLICY "Steps: read" ON public.plan_action_steps
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.plan_phases ph
    JOIN public.recovery_plans rp ON rp.id = ph.plan_id
    WHERE ph.id = plan_action_steps.phase_id
      AND (
        rp.participant_id = get_participant_profile_id()
        OR is_assigned_peer(rp.participant_id)
        OR get_user_role() = 'admin'::user_role
      )
  )
);

DROP POLICY IF EXISTS "Steps: participant complete" ON public.plan_action_steps;
CREATE POLICY "Steps: participant complete" ON public.plan_action_steps
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.plan_phases ph
    JOIN public.recovery_plans rp ON rp.id = ph.plan_id
    WHERE ph.id = plan_action_steps.phase_id
      AND (
        rp.participant_id = get_participant_profile_id()
        OR is_assigned_peer(rp.participant_id)
        OR get_user_role() = 'admin'::user_role
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.plan_phases ph
    JOIN public.recovery_plans rp ON rp.id = ph.plan_id
    WHERE ph.id = plan_action_steps.phase_id
      AND (
        rp.participant_id = get_participant_profile_id()
        OR is_assigned_peer(rp.participant_id)
        OR get_user_role() = 'admin'::user_role
      )
  )
);
