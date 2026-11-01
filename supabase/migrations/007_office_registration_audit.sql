-- =====================================================================
-- iSave migration 007: audit trail for office registration
--
-- The Worker creates the account with the service role, so the usual audit helper
-- (which reads the signed-in user) would record "System". This function lets the Worker,
-- and only the Worker, write the audit row with the real staff member as the actor.
--   * service_role only: staff and members cannot call it from the browser.
--   * the actor must hold a staff role, and the member must really be an office registration.
--   * once per member, so a retry cannot write a second row.
-- =====================================================================

create or replace function public.log_office_registration(p_member_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles
                  where user_id = p_actor_id and role in ('finance', 'admin', 'super_admin')) then
    raise exception 'The person registering must be office staff' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles
                  where id = p_member_id and registered_via = 'staff') then
    raise exception 'That member was not registered by staff';
  end if;
  if exists (select 1 from public.audit_logs
              where action = 'member.registered_in_office' and entity_id = p_member_id::text) then
    return;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (p_actor_id, 'member.registered_in_office', 'profile', p_member_id::text, '{}'::jsonb);
end $$;

revoke all on function public.log_office_registration(uuid, uuid) from public, anon, authenticated;
grant execute on function public.log_office_registration(uuid, uuid) to service_role;
