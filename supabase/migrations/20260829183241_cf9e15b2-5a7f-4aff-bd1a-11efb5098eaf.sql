CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  subject text NOT NULL,
  body_markdown text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates"
ON public.email_templates FOR ALL TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE TRIGGER email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.email_templates (event_key, display_name, description, subject, body_markdown) VALUES
('role_granted', 'Role granted', 'Sent when an admin gives a user a new role.', 'You now have {{role}} access on Recovery Passport', 'Hi {{first_name}},

You''ve been given **{{role}}** access on Recovery Passport.

Sign in to get started: {{app_url}}

— The Recovery Epicenter Foundation team'),
('role_removed', 'Role removed', 'Sent when an admin removes a role from a user.', 'Your {{role}} access was removed', 'Hi {{first_name}},

Your **{{role}}** access on Recovery Passport has been removed.

If you think this was a mistake, please reach out to your program administrator.

— The Recovery Epicenter Foundation team'),
('peer_application_approved', 'Peer application approved', 'Sent when an admin approves a peer specialist application.', 'You''re approved — welcome to the team', 'Hi {{first_name}},

Your peer specialist application has been approved. Your caseload is ready when you are.

Sign in: {{app_url}}

— The Recovery Epicenter Foundation team'),
('peer_application_rejected', 'Peer application declined', 'Sent when an admin declines a peer specialist application.', 'An update on your peer specialist application', 'Hi {{first_name}},

Thank you for applying to be a peer specialist. After review, we''re not able to approve your application at this time.

If you''d like to talk it through, please contact your program administrator.

— The Recovery Epicenter Foundation team'),
('milestone_unlocked', 'Milestone unlocked', 'Sent to a participant when they earn a milestone.', 'You earned: {{milestone_name}}', 'Hi {{first_name}},

Nice work — you just unlocked **{{milestone_name}}**.

See it on your card: {{app_url}}

— The Recovery Epicenter Foundation team'),
('level_up', 'Card level up', 'Sent to a participant when their card level increases.', 'You reached {{level}}!', 'Hi {{first_name}},

Your card just leveled up to **{{level}}**. That''s real progress.

Check out your card: {{app_url}}

— The Recovery Epicenter Foundation team');