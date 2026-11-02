-- 010: finance staff can switch to "admin mode", and admins can create staff accounts.
--
-- The manager has approved that office staff may act as administrators. Admin mode makes that
-- an explicit, audited switch instead of a permanent role:
--   * only people who hold the finance role can switch it on or off (set_admin_mode);
--   * while it is on, is_admin() is true for them, so every admin screen and rule applies;
--   * every switch is written to the audit log;
--   * it never lets anyone change roles: roles_manage stays super_admin only, and new staff
--     accounts are created by the Worker through grant_staff_role(), which re-checks the actor.

create table public.staff_admin_mode (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  enabled    boolean not null default false,
  changed_at timestamptz not null default now()
);
alter table public.staff_admin_mode enable row level security;
create policy staff_admin_mode_select on public.staff_admin_mode for select
  using (user_id = auth.uid());
revoke all on public.staff_admin_mode from anon, authenticated;
grant select on public.staff_admin_mode to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role in ('admin', 'super_admin'))
      or exists (select 1
                 from public.staff_admin_mode m
                 join public.user_roles r on r.user_id = m.user_id and r.role = 'finance'
                 where m.user_id = auth.uid() and m.enabled)
$$;

create or replace function public.set_admin_mode(p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role('finance') then
    raise exception 'Only office staff can switch admin mode' using errcode = '42501';
  end if;
  insert into public.staff_admin_mode (user_id, enabled, changed_at)
    values (auth.uid(), p_on, now())
    on conflict (user_id) do update set enabled = excluded.enabled, changed_at = now();
  perform public.write_audit(case when p_on then 'admin_mode.on' else 'admin_mode.off' end,
                             'staff', auth.uid()::text, '{}'::jsonb);
  return p_on;
end $$;
revoke all on function public.set_admin_mode(boolean) from public, anon;
grant execute on function public.set_admin_mode(boolean) to authenticated;

-- Who may create which staff accounts. Real admins: finance or admin. Finance staff in admin
-- mode: finance only (so admin mode cannot be used to mint permanent administrators).
create or replace function public.staff_grant_allowed(p_actor uuid, p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_role not in ('finance', 'admin') then false
    when exists (select 1 from public.user_roles
                 where user_id = p_actor and role in ('admin', 'super_admin')) then true
    when p_role = 'finance'
         and exists (select 1 from public.user_roles where user_id = p_actor and role = 'finance')
         and exists (select 1 from public.staff_admin_mode where user_id = p_actor and enabled) then true
    else false
  end
$$;
revoke all on function public.staff_grant_allowed(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_grant_allowed(uuid, text) to service_role;

-- Called by the Worker after it creates the sign-in account.
create or replace function public.grant_staff_role(p_user uuid, p_actor uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_grant_allowed(p_actor, p_role) then
    raise exception 'You are not allowed to create this kind of staff account' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role) values (p_user, p_role::public.app_role)
    on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (p_actor, 'staff.created', 'profile', p_user::text, jsonb_build_object('role', p_role));
end $$;
revoke all on function public.grant_staff_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.grant_staff_role(uuid, uuid, text) to service_role;
