
-- Enum
CREATE TYPE public.intake_form_type AS ENUM (
  'house_rules',
  'disclosure_consent',
  'belongings_consent',
  'services_consent',
  'liability_waiver',
  'non_tenancy',
  'contribution_agreement'
);

-- 1. Templates
CREATE TABLE public.intake_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type public.intake_form_type NOT NULL,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_form_templates_current
  ON public.intake_form_templates(program_id, form_type)
  WHERE is_current = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_form_templates TO authenticated;
GRANT ALL ON public.intake_form_templates TO service_role;

ALTER TABLE public.intake_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read intake form templates"
  ON public.intake_form_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage intake form templates"
  ON public.intake_form_templates FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE TRIGGER trg_intake_form_templates_updated
  BEFORE UPDATE ON public.intake_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Signatures
CREATE TABLE public.intake_form_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id uuid NOT NULL REFERENCES public.intake_sessions(id) ON DELETE CASCADE,
  form_type public.intake_form_type NOT NULL,
  template_id uuid NOT NULL REFERENCES public.intake_form_templates(id),
  initials jsonb,
  signature_image_path text NOT NULL,
  witness_signature_image_path text NOT NULL,
  witness_staff_id uuid NOT NULL REFERENCES public.users(id),
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_form_signatures_session ON public.intake_form_signatures(intake_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_form_signatures TO authenticated;
GRANT ALL ON public.intake_form_signatures TO service_role;
ALTER TABLE public.intake_form_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage intake signatures"
  ON public.intake_form_signatures FOR ALL TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'))
  WITH CHECK (public.get_user_role() IN ('peer_specialist','admin'));

CREATE POLICY "Participants read own intake signatures"
  ON public.intake_form_signatures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_sessions s
      JOIN public.participant_profiles pp ON pp.id = s.participant_id
      WHERE s.id = intake_form_signatures.intake_session_id
        AND pp.user_id = auth.uid()
    )
  );

-- 3. Authorized contacts
CREATE TABLE public.intake_authorized_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id uuid NOT NULL REFERENCES public.intake_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_authorized_contacts_session ON public.intake_authorized_contacts(intake_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_authorized_contacts TO authenticated;
GRANT ALL ON public.intake_authorized_contacts TO service_role;
ALTER TABLE public.intake_authorized_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage intake contacts"
  ON public.intake_authorized_contacts FOR ALL TO authenticated
  USING (public.get_user_role() IN ('peer_specialist','admin'))
  WITH CHECK (public.get_user_role() IN ('peer_specialist','admin'));

CREATE POLICY "Participants read own intake contacts"
  ON public.intake_authorized_contacts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_sessions s
      JOIN public.participant_profiles pp ON pp.id = s.participant_id
      WHERE s.id = intake_authorized_contacts.intake_session_id
        AND pp.user_id = auth.uid()
    )
  );

-- 4. Storage policies on signatures bucket (intake/ prefix, staff-managed)
CREATE POLICY "Staff manage intake signatures storage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = 'intake'
    AND public.get_user_role() IN ('peer_specialist','admin')
  )
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = 'intake'
    AND public.get_user_role() IN ('peer_specialist','admin')
  );

-- 5. Seed 7 templates for The Catcher's Mitt
INSERT INTO public.intake_form_templates (form_type, program_id, content, version, is_current)
SELECT ft.form_type::public.intake_form_type, p.id, ft.content, 1, true
FROM public.programs p
CROSS JOIN (VALUES
  ('house_rules', 'SEED PENDING — official house rules text to follow.'),
  ('disclosure_consent', 'SEED PENDING — official consent to disclose text to follow.'),
  ('belongings_consent', 'SEED PENDING — official personal belongings consent text to follow.'),
  ('services_consent', 'SEED PENDING — official consent for services text to follow. Two initial checkboxes required: Peer Support Observation and Support Services, and Assessments.'),
  ('liability_waiver', 'SEED PENDING — official liability waiver text to follow.'),
  ('non_tenancy', 'SEED PENDING — official non-tenancy acknowledgement text to follow.'),
  ('contribution_agreement', 'SEED PENDING — official contribution agreement text to follow.')
) AS ft(form_type, content)
WHERE p.name = 'The Catcher''s Mitt';
