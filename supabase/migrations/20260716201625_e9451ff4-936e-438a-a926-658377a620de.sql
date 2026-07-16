
-- Enums
CREATE TYPE public.ua_result AS ENUM ('pass', 'fail');
CREATE TYPE public.participant_status AS ENUM ('active', 'discharged');

-- participant_profiles additions
ALTER TABLE public.participant_profiles
  ADD COLUMN admission_date date,
  ADD COLUMN participant_status public.participant_status;

-- intake_screening_results
CREATE TABLE public.intake_screening_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id uuid NOT NULL UNIQUE REFERENCES public.intake_sessions(id) ON DELETE CASCADE,
  breathalyzer_result numeric,
  administered_by uuid NOT NULL REFERENCES public.users(id),
  administered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_screening_results TO authenticated;
GRANT ALL ON public.intake_screening_results TO service_role;
ALTER TABLE public.intake_screening_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screening: staff select" ON public.intake_screening_results FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'));
CREATE POLICY "screening: staff insert" ON public.intake_screening_results FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('peer_specialist','admin'));
CREATE POLICY "screening: staff update" ON public.intake_screening_results FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'))
  WITH CHECK (public.get_user_role() IN ('peer_specialist','admin'));
CREATE POLICY "screening: staff delete" ON public.intake_screening_results FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'));
CREATE TRIGGER set_intake_screening_updated_at BEFORE UPDATE ON public.intake_screening_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- intake_ua_panels
CREATE TABLE public.intake_ua_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_result_id uuid NOT NULL REFERENCES public.intake_screening_results(id) ON DELETE CASCADE,
  panel_name text NOT NULL,
  result public.ua_result NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ua_panels_screening ON public.intake_ua_panels(screening_result_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_ua_panels TO authenticated;
GRANT ALL ON public.intake_ua_panels TO service_role;
ALTER TABLE public.intake_ua_panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua_panels: staff all" ON public.intake_ua_panels FOR ALL TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'))
  WITH CHECK (public.get_user_role() IN ('peer_specialist','admin'));

-- intake_belongings_log
CREATE TABLE public.intake_belongings_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id uuid NOT NULL UNIQUE REFERENCES public.intake_sessions(id) ON DELETE CASCADE,
  items_summary text,
  prohibited_items_found boolean NOT NULL DEFAULT false,
  prohibited_items_notes text,
  dryer_treatment_completed boolean NOT NULL DEFAULT false,
  searched_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_belongings_log TO authenticated;
GRANT ALL ON public.intake_belongings_log TO service_role;
ALTER TABLE public.intake_belongings_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "belongings: staff all" ON public.intake_belongings_log FOR ALL TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'))
  WITH CHECK (public.get_user_role() IN ('peer_specialist','admin'));
CREATE TRIGGER set_intake_belongings_updated_at BEFORE UPDATE ON public.intake_belongings_log
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Storage: participant can read signature files under intake/<session_id>/
CREATE POLICY "Signatures: participant read own intake files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = 'intake'
    AND EXISTS (
      SELECT 1
      FROM public.intake_sessions s
      JOIN public.participant_profiles pp ON pp.id = s.participant_id
      WHERE s.id::text = (storage.foldername(name))[2]
        AND pp.user_id = auth.uid()
    )
  );
