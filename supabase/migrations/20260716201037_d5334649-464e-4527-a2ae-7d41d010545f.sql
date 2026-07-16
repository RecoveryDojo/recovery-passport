
-- Enum
DO $$ BEGIN
  CREATE TYPE public.substance_frequency AS ENUM ('daily', 'weekly', 'occasional', 'not_in_use');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. intake_substance_use
CREATE TABLE public.intake_substance_use (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id uuid NOT NULL REFERENCES public.intake_sessions(id) ON DELETE CASCADE,
  substance_name text NOT NULL,
  frequency_of_use public.substance_frequency NOT NULL,
  route_of_use text,
  age_of_first_use integer,
  last_use_date date,
  prior_treatment_attempts integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_substance_use_session ON public.intake_substance_use(intake_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_substance_use TO authenticated;
GRANT ALL ON public.intake_substance_use TO service_role;
ALTER TABLE public.intake_substance_use ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage intake substance use"
  ON public.intake_substance_use
  TO authenticated
  USING (get_user_role() = ANY (ARRAY['peer_specialist'::user_role, 'admin'::user_role]))
  WITH CHECK (get_user_role() = ANY (ARRAY['peer_specialist'::user_role, 'admin'::user_role]));

CREATE POLICY "Participants read own intake substance use"
  ON public.intake_substance_use
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.intake_sessions s
    JOIN public.participant_profiles pp ON pp.id = s.participant_id
    WHERE s.id = intake_substance_use.intake_session_id
      AND pp.user_id = auth.uid()
  ));

CREATE TRIGGER trg_intake_substance_use_updated
BEFORE UPDATE ON public.intake_substance_use
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. intake_clinical_details
CREATE TABLE public.intake_clinical_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id uuid NOT NULL UNIQUE REFERENCES public.intake_sessions(id) ON DELETE CASCADE,
  medical_concerns text,
  hospitalized_last_90_days boolean NOT NULL DEFAULT false,
  prior_pathways text,
  needs_vital_docs boolean NOT NULL DEFAULT false,
  vital_docs_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_clinical_details TO authenticated;
GRANT ALL ON public.intake_clinical_details TO service_role;
ALTER TABLE public.intake_clinical_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage intake clinical details"
  ON public.intake_clinical_details
  TO authenticated
  USING (get_user_role() = ANY (ARRAY['peer_specialist'::user_role, 'admin'::user_role]))
  WITH CHECK (get_user_role() = ANY (ARRAY['peer_specialist'::user_role, 'admin'::user_role]));

CREATE POLICY "Participants read own intake clinical details"
  ON public.intake_clinical_details
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.intake_sessions s
    JOIN public.participant_profiles pp ON pp.id = s.participant_id
    WHERE s.id = intake_clinical_details.intake_session_id
      AND pp.user_id = auth.uid()
  ));

CREATE TRIGGER trg_intake_clinical_details_updated
BEFORE UPDATE ON public.intake_clinical_details
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. participant_demographics (tighter RLS)
CREATE TABLE public.participant_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL UNIQUE REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  race_ethnicity text,
  gender text,
  primary_language text,
  sexual_orientation_gender_identity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_demographics TO authenticated;
GRANT ALL ON public.participant_demographics TO service_role;
ALTER TABLE public.participant_demographics ENABLE ROW LEVEL SECURITY;

-- Participant: read own
CREATE POLICY "Participant reads own demographics"
  ON public.participant_demographics FOR SELECT
  TO authenticated
  USING (participant_id = get_participant_profile_id());

-- Participant: update own
CREATE POLICY "Participant updates own demographics"
  ON public.participant_demographics FOR UPDATE
  TO authenticated
  USING (participant_id = get_participant_profile_id())
  WITH CHECK (participant_id = get_participant_profile_id());

-- Participant: insert own
CREATE POLICY "Participant inserts own demographics"
  ON public.participant_demographics FOR INSERT
  TO authenticated
  WITH CHECK (participant_id = get_participant_profile_id());

-- Admin: read all
CREATE POLICY "Admin reads demographics"
  ON public.participant_demographics FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin'::user_role);

-- Assigned peer only: insert
CREATE POLICY "Assigned peer inserts demographics"
  ON public.participant_demographics FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = 'peer_specialist'::user_role
    AND is_assigned_peer(participant_id)
  );

-- Assigned peer only: update
CREATE POLICY "Assigned peer updates demographics"
  ON public.participant_demographics FOR UPDATE
  TO authenticated
  USING (
    get_user_role() = 'peer_specialist'::user_role
    AND is_assigned_peer(participant_id)
  )
  WITH CHECK (
    get_user_role() = 'peer_specialist'::user_role
    AND is_assigned_peer(participant_id)
  );

CREATE TRIGGER trg_participant_demographics_updated
BEFORE UPDATE ON public.participant_demographics
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
