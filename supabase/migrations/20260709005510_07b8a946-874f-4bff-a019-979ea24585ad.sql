
-- Enums
CREATE TYPE public.assessment_instrument_source AS ENUM ('standard', 'custom');
CREATE TYPE public.assessment_scoring_method AS ENUM ('sum', 'average');
CREATE TYPE public.assessment_instrument_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.assessment_item_type AS ENUM ('labeled_scale', 'single_select', 'multi_select', 'yes_no', 'numeric', 'free_text');
CREATE TYPE public.assessment_severity AS ENUM ('none', 'mild', 'moderate', 'severe');
CREATE TYPE public.assessment_cadence AS ENUM ('intake', 'thirty_day', 'sixty_day', 'ninety_day', 'discharge', 'ad_hoc');
CREATE TYPE public.assessment_assignment_status AS ENUM ('pending', 'completed', 'skipped', 'expired');

-- Add new notification type enum value (not referenced in this migration)
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'assessment_flagged';

-- ============================================================
-- assessment_instruments
-- ============================================================
CREATE TABLE public.assessment_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source public.assessment_instrument_source NOT NULL DEFAULT 'custom',
  is_locked boolean NOT NULL DEFAULT false,
  scoring_method public.assessment_scoring_method NOT NULL DEFAULT 'sum',
  produces_overall_score boolean NOT NULL DEFAULT true,
  status public.assessment_instrument_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  template_group_id uuid,
  created_by uuid REFERENCES auth.users(id),
  higher_is_better boolean NOT NULL DEFAULT true,
  min_score numeric,
  max_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_instruments TO authenticated;
GRANT ALL ON public.assessment_instruments TO service_role;
ALTER TABLE public.assessment_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instruments readable by any authenticated user"
  ON public.assessment_instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage instruments"
  ON public.assessment_instruments FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE TRIGGER trg_assessment_instruments_updated_at
  BEFORE UPDATE ON public.assessment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- assessment_instrument_items
-- ============================================================
CREATE TABLE public.assessment_instrument_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.assessment_instruments(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  item_type public.assessment_item_type NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  is_reverse_scored boolean NOT NULL DEFAULT false,
  is_flag_item boolean NOT NULL DEFAULT false,
  flag_threshold numeric,
  help_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessment_items_instrument ON public.assessment_instrument_items(instrument_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_instrument_items TO authenticated;
GRANT ALL ON public.assessment_instrument_items TO service_role;
ALTER TABLE public.assessment_instrument_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items readable by any authenticated user"
  ON public.assessment_instrument_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage items"
  ON public.assessment_instrument_items FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE TRIGGER trg_assessment_items_updated_at
  BEFORE UPDATE ON public.assessment_instrument_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- assessment_instrument_options
-- ============================================================
CREATE TABLE public.assessment_instrument_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.assessment_instrument_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  value numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessment_options_item ON public.assessment_instrument_options(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_instrument_options TO authenticated;
GRANT ALL ON public.assessment_instrument_options TO service_role;
ALTER TABLE public.assessment_instrument_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Options readable by any authenticated user"
  ON public.assessment_instrument_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage options"
  ON public.assessment_instrument_options FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE TRIGGER trg_assessment_options_updated_at
  BEFORE UPDATE ON public.assessment_instrument_options
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- assessment_bands
-- ============================================================
CREATE TABLE public.assessment_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.assessment_instruments(id) ON DELETE CASCADE,
  min_score numeric NOT NULL,
  max_score numeric NOT NULL,
  label text NOT NULL,
  severity public.assessment_severity NOT NULL DEFAULT 'none',
  guidance text,
  triggers_alert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessment_bands_instrument ON public.assessment_bands(instrument_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_bands TO authenticated;
GRANT ALL ON public.assessment_bands TO service_role;
ALTER TABLE public.assessment_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bands readable by any authenticated user"
  ON public.assessment_bands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bands"
  ON public.assessment_bands FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE TRIGGER trg_assessment_bands_updated_at
  BEFORE UPDATE ON public.assessment_bands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- assessment_assignments
-- ============================================================
CREATE TABLE public.assessment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.assessment_instruments(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  cadence_tag public.assessment_cadence NOT NULL DEFAULT 'ad_hoc',
  due_date date,
  status public.assessment_assignment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessment_assignments_participant ON public.assessment_assignments(participant_id);
CREATE INDEX idx_assessment_assignments_instrument ON public.assessment_assignments(instrument_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_assignments TO authenticated;
GRANT ALL ON public.assessment_assignments TO service_role;
ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read own assignments"
  ON public.assessment_assignments FOR SELECT TO authenticated
  USING (participant_id = public.get_participant_profile_id());
CREATE POLICY "Assigned peers read participant assignments"
  ON public.assessment_assignments FOR SELECT TO authenticated
  USING (public.is_assigned_peer(participant_id));
CREATE POLICY "Admins read all assignments"
  ON public.assessment_assignments FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');
CREATE POLICY "Peers create assignments for their participants"
  ON public.assessment_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_peer(participant_id) OR public.get_user_role() = 'admin');
CREATE POLICY "Peers update participant assignments"
  ON public.assessment_assignments FOR UPDATE TO authenticated
  USING (public.is_assigned_peer(participant_id) OR public.get_user_role() = 'admin')
  WITH CHECK (public.is_assigned_peer(participant_id) OR public.get_user_role() = 'admin');
CREATE POLICY "Participants update own assignment status"
  ON public.assessment_assignments FOR UPDATE TO authenticated
  USING (participant_id = public.get_participant_profile_id())
  WITH CHECK (participant_id = public.get_participant_profile_id());
CREATE POLICY "Admins delete assignments"
  ON public.assessment_assignments FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE TRIGGER trg_assessment_assignments_updated_at
  BEFORE UPDATE ON public.assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Add columns to assessment_sessions (both nullable, safe additive)
-- ============================================================
ALTER TABLE public.assessment_sessions
  ADD COLUMN instrument_id uuid REFERENCES public.assessment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN assignment_id uuid REFERENCES public.assessment_assignments(id) ON DELETE SET NULL;

CREATE INDEX idx_assessment_sessions_instrument ON public.assessment_sessions(instrument_id);
CREATE INDEX idx_assessment_sessions_assignment ON public.assessment_sessions(assignment_id);

-- ============================================================
-- assessment_responses
-- ============================================================
CREATE TABLE public.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.assessment_instrument_items(id) ON DELETE RESTRICT,
  option_id uuid REFERENCES public.assessment_instrument_options(id) ON DELETE SET NULL,
  numeric_value numeric,
  text_value text,
  points numeric,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessment_responses_session ON public.assessment_responses(session_id);
CREATE INDEX idx_assessment_responses_item ON public.assessment_responses(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_responses TO authenticated;
GRANT ALL ON public.assessment_responses TO service_role;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read own responses"
  ON public.assessment_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.id = assessment_responses.session_id
      AND s.participant_id = public.get_participant_profile_id()
  ));
CREATE POLICY "Assigned peers read participant responses"
  ON public.assessment_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.id = assessment_responses.session_id
      AND public.is_assigned_peer(s.participant_id)
  ));
CREATE POLICY "Admins read all responses"
  ON public.assessment_responses FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');
CREATE POLICY "Participants create own responses"
  ON public.assessment_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.id = assessment_responses.session_id
      AND s.participant_id = public.get_participant_profile_id()
  ));
CREATE POLICY "Peers create responses for their participants"
  ON public.assessment_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.id = assessment_responses.session_id
      AND (public.is_assigned_peer(s.participant_id) OR public.get_user_role() = 'admin')
  ));

CREATE TRIGGER trg_assessment_responses_updated_at
  BEFORE UPDATE ON public.assessment_responses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
