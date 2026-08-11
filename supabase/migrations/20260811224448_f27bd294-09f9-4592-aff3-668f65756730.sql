INSERT INTO public.app_config (key, value, updated_at)
VALUES ('owner_user_id', '7ceba0d3-4cf9-48f3-a351-0fe4c5b77ba0', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.owner_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(value, '')::uuid FROM public.app_config WHERE key = 'owner_user_id';
$$;

CREATE OR REPLACE FUNCTION public.protect_owner_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := public.owner_user_id();
BEGIN
  IF v_owner IS NOT NULL AND OLD.user_id = v_owner AND OLD.role = 'admin' THEN
    IF auth.uid() IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'The owner admin role can only be removed by the owner';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_owner_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_owner_admin_role
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_admin_role();

CREATE OR REPLACE FUNCTION public.protect_owner_primary_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := public.owner_user_id();
BEGIN
  IF v_owner IS NOT NULL AND OLD.id = v_owner AND OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin' THEN
    IF auth.uid() IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'The owner admin role can only be changed by the owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_owner_primary_role ON public.users;
CREATE TRIGGER trg_protect_owner_primary_role
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_primary_role();

INSERT INTO public.user_roles (user_id, role)
VALUES ('7ceba0d3-4cf9-48f3-a351-0fe4c5b77ba0', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;