-- Tests for migration 010: admin mode and staff account creation rules.
do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  fin   uuid := '00000000-0000-0000-0000-0000000000f1';
  mem   uuid := '00000000-0000-0000-0000-0000000000b1';
  newu  uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  perform t.as_owner();
  insert into auth.users (id, email, raw_user_meta_data) values (newu, 'newstaff@test.local', '{"full_name":"New Staff"}');

  -- Before the switch, finance staff are not admins.
  perform t.as_user(fin);
  perform t.assert(not public.is_admin(), 'finance staff are not admins by default');
  perform t.expect_error($q$insert into public.team_members (full_name, role_title) values ('A','B')$q$, '%row-level security%');

  -- Members cannot switch it on.
  perform t.as_user(mem);
  perform t.expect_error('select public.set_admin_mode(true)', '%Only office staff%');

  -- Finance staff can, and it is audited.
  perform t.as_user(fin);
  perform t.assert(public.set_admin_mode(true), 'switch on');
  perform t.assert(public.is_admin(), 'admin rules apply while the switch is on');
  insert into public.team_members (full_name, role_title) values ('Acting Admin Test', 'Tester');
  perform t.as_owner();
  perform t.assert(exists (select 1 from public.audit_logs where action = 'admin_mode.on' and actor_id = fin), 'switching on is audited');

  -- Admin mode never lets anyone change roles directly.
  perform t.as_user(fin);
  perform t.expect_error(format($q$insert into public.user_roles (user_id, role) values (%L, 'admin')$q$, fin), '%row-level security%');

  -- Switching off removes the powers again.
  perform t.assert(not public.set_admin_mode(false), 'switch off');
  perform t.assert(not public.is_admin(), 'back to finance only');
  perform t.as_owner();
  perform t.assert(exists (select 1 from public.audit_logs where action = 'admin_mode.off' and actor_id = fin), 'switching off is audited');

  -- Who may create which staff accounts.
  execute 'set local role service_role';
  perform t.assert(not public.staff_grant_allowed(fin, 'finance'), 'finance outside admin mode cannot create staff');
  perform t.assert(public.staff_grant_allowed(admin, 'finance') and public.staff_grant_allowed(admin, 'admin'), 'admins can create finance or admin staff');
  perform t.assert(not public.staff_grant_allowed(admin, 'super_admin'), 'nobody creates super admins here');
  perform t.assert(not public.staff_grant_allowed(mem, 'finance'), 'members cannot');
  perform t.as_owner();
  perform t.as_user(fin);
  perform public.set_admin_mode(true);
  perform t.as_owner();
  execute 'set local role service_role';
  perform t.assert(public.staff_grant_allowed(fin, 'finance'), 'finance in admin mode can create finance staff');
  perform t.assert(not public.staff_grant_allowed(fin, 'admin'), 'but not administrators');
  perform t.expect_error(format('select public.grant_staff_role(%L, %L, %L)', newu, fin, 'admin'), '%not allowed%');
  perform public.grant_staff_role(newu, fin, 'finance');
  perform public.grant_staff_role(newu, fin, 'finance');
  perform t.as_owner();
  perform t.assert((select count(*) from public.user_roles where user_id = newu and role = 'finance') = 1, 'the role is granted once');
  perform t.assert(exists (select 1 from public.audit_logs where action = 'staff.created' and entity_id = newu::text and actor_id = fin), 'creation is audited with the real actor');

  -- Only the Worker can call these.
  perform t.as_user(fin);
  perform t.expect_error(format('select public.grant_staff_role(%L, %L, %L)', newu, fin, 'finance'), '%permission denied%');
  perform t.as_owner();
end $$;
