-- 1. Signup trigger: coerce role to participant/peer_specialist only
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    values (new.id, '', '');
  end if;

  if user_role_value = 'peer_specialist' then
    insert into public.peer_specialist_profiles (user_id, first_name, last_name, approval_status)
    values (new.id, '', '', 'pending');
  end if;

  return new;
end;
$function$;

-- 2. Self-update policy must not allow role changes
DROP POLICY IF EXISTS "Users can update own row" ON public.users;

CREATE OR REPLACE FUNCTION public.current_user_role_raw()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select role from public.users where id = auth.uid();
$function$;

CREATE POLICY "Users can update own row"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = public.current_user_role_raw());

-- 3. Prevent removing the last admin
CREATE OR REPLACE FUNCTION public.prevent_last_admin_demotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if OLD.role = 'admin' and NEW.role is distinct from 'admin' then
    if (select count(*) from public.users where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last remaining admin';
    end if;
  end if;
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_demotion ON public.users;
CREATE TRIGGER trg_prevent_last_admin_demotion
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_demotion();