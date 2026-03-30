
-- Allow participants to update is_active on their own plan phases (for auto-unlock)
CREATE POLICY "Phases: participant unlock"
ON public.plan_phases
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.recovery_plans rp
    WHERE rp.id = plan_phases.plan_id
    AND rp.participant_id = get_participant_profile_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recovery_plans rp
    WHERE rp.id = plan_phases.plan_id
    AND rp.participant_id = get_participant_profile_id()
  )
);
