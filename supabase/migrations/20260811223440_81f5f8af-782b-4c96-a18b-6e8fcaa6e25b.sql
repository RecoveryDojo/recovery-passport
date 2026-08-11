-- 1. Table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions (security definer, non-recursive)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.highest_role(_user_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'peer_specialist' THEN 2
    WHEN 'participant' THEN 3
  END
  LIMIT 1;
$$;

-- 3. Backfill from users.role
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. RLS policies
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can grant roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can revoke roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. get_user_role now reads the new table (keeps ~60 existing policies working)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.highest_role(auth.uid()),
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role_raw()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.highest_role(auth.uid()),
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$;

-- 6. Guard: never remove the last admin
CREATE OR REPLACE FUNCTION public.prevent_last_admin_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last remaining admin';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_last_admin_role_removal
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_role_removal();

-- 7. Keep users.role in sync with the highest role, and create side-effect profiles
CREATE OR REPLACE FUNCTION public.sync_primary_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_top public.user_role;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'peer_specialist' AND NOT EXISTS (
      SELECT 1 FROM public.peer_specialist_profiles WHERE user_id = v_user_id
    ) THEN
      INSERT INTO public.peer_specialist_profiles (user_id, first_name, last_name, approval_status)
      VALUES (v_user_id, '', '', 'pending');
    END IF;

    IF NEW.role = 'participant' AND NOT EXISTS (
      SELECT 1 FROM public.participant_profiles WHERE user_id = v_user_id
    ) THEN
      INSERT INTO public.participant_profiles (user_id, first_name, last_name)
      VALUES (v_user_id, '', '');
    END IF;
  END IF;

  SELECT public.highest_role(v_user_id) INTO v_top;

  IF v_top IS NOT NULL THEN
    UPDATE public.users SET role = v_top WHERE id = v_user_id AND role IS DISTINCT FROM v_top;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_primary_role
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_primary_role();

-- 8. Signup writes into user_roles too (participant / peer_specialist only)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  requested_role text;
  user_role_value user_role;
begin
  requested_role := new.raw_user_meta_data->>'role';

  if requested_role = 'peer_specialist' then
    user_role_value := 'peer_specialist';
  else
    user_role_value := 'participant';
  end if;

  insert into public.users (id, email, phone, role)
  values (new.id, coalesce(new.email, ''), new.phone, user_role_value);

  if user_role_value = 'participant' then
    insert into public.participant_profiles (user_id, first_name, last_name)
    values (new.id, '', '')
    on conflict do nothing;
  end if;

  if user_role_value = 'peer_specialist' then
    insert into public.peer_specialist_profiles (user_id, first_name, last_name, approval_status)
    values (new.id, '', '', 'pending')
    on conflict do nothing;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, user_role_value)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;