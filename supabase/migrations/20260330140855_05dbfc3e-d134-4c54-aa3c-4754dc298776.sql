CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  user_role_value user_role;
begin
  user_role_value := coalesce(
    (new.raw_user_meta_data->>'role')::user_role,
    'participant'
  );

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