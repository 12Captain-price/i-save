-- 008: mark a profile as an office registration when the staff flag arrives after sign-up
create or replace function public.sync_registered_via()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data->>'registered_via' = 'staff' then
    update public.profiles
       set registered_via = 'staff'
     where id = new.id and registered_via <> 'staff';
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_staff_flag on auth.users;
create trigger on_auth_user_staff_flag
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.sync_registered_via();