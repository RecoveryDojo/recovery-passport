-- Phase 2C: allow participants to insert their own progress_notes (for journal + ask-peer surfaces)
DROP POLICY IF EXISTS "Notes: create" ON public.progress_notes;
CREATE POLICY "Notes: insert"
ON public.progress_notes
FOR INSERT
WITH CHECK (
  get_user_role() IN ('peer_specialist'::user_role, 'admin'::user_role)
  OR (author_id = auth.uid() AND participant_id = get_participant_profile_id())
);
