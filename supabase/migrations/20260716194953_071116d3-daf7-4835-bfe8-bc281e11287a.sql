-- Enum
CREATE TYPE public.intake_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- Table
CREATE TABLE public.intake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id),
  participant_id uuid REFERENCES public.participant_profiles(id) ON DELETE SET NULL,
  started_by uuid NOT NULL REFERENCES public.users(id),
  status public.intake_status NOT NULL DEFAULT 'in_progress',
  current_step integer NOT NULL DEFAULT 1,
  goal_1 text,
  goal_2 text,
  goal_3 text,
  room_note text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_sessions_program ON public.intake_sessions(program_id);
CREATE INDEX idx_intake_sessions_status ON public.intake_sessions(status);
CREATE INDEX idx_intake_sessions_participant ON public.intake_sessions(participant_id);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.intake_sessions TO authenticated;
GRANT ALL ON public.intake_sessions TO service_role;

-- RLS
ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intake: staff select all"
  ON public.intake_sessions FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('peer_specialist', 'admin'));

CREATE POLICY "Intake: participant select own completed"
  ON public.intake_sessions FOR SELECT
  TO authenticated
  USING (
    status = 'completed'
    AND participant_id IS NOT NULL
    AND participant_id = public.get_participant_profile_id()
  );

CREATE POLICY "Intake: staff insert"
  ON public.intake_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('peer_specialist', 'admin'));

CREATE POLICY "Intake: staff update"
  ON public.intake_sessions FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('peer_specialist', 'admin'))
  WITH CHECK (public.get_user_role() IN ('peer_specialist', 'admin'));

-- updated_at trigger
CREATE TRIGGER set_intake_sessions_updated_at
  BEFORE UPDATE ON public.intake_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_intake_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'intake_session_started';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      v_action := 'intake_session_completed';
    ELSIF NEW.status = 'abandoned' AND OLD.status IS DISTINCT FROM 'abandoned' THEN
      v_action := 'intake_session_abandoned';
    ELSE
      v_action := 'intake_session_resumed';
    END IF;
  END IF;

  INSERT INTO public.audit_log (user_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    v_action,
    'intake_sessions',
    NEW.id,
    jsonb_build_object(
      'current_step', NEW.current_step,
      'status', NEW.status,
      'participant_id', NEW.participant_id
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_intake_sessions_ins
  AFTER INSERT ON public.intake_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_intake_session();

CREATE TRIGGER audit_intake_sessions_upd
  AFTER UPDATE ON public.intake_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_intake_session();

-- Storage RLS for the `signatures` bucket (bucket created via tool)
CREATE POLICY "Signatures: staff upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND public.get_user_role() IN ('peer_specialist', 'admin')
  );

CREATE POLICY "Signatures: staff read all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.get_user_role() IN ('peer_specialist', 'admin')
  );

CREATE POLICY "Signatures: participant read own folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = public.get_participant_profile_id()::text
  );

CREATE POLICY "Signatures: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.get_user_role() IN ('peer_specialist', 'admin')
  );