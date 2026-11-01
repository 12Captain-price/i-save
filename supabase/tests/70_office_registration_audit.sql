-- Tests for migration 007: the Worker can log an office registration, nobody else can.

do $$
declare v_member uuid := '00000000-0000-0000-0000-0000000000c1';
begin
  perform t.as_owner();
  -- What the Worker's admin createUser call produces: app metadata says "staff".
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (v_member, 'walkin1@test.local',
     '{"full_name":"Walk In One","phone":"+263779990001","national_id":"63-123456-A-12","age_confirmed":"true","terms_accepted":"true"}',
     '{"registered_via":"staff"}');
  perform t.assert((select registered_via from public.profiles where id = v_member) = 'staff', 'the account is marked as an office registration');
  perform t.assert((select status from public.profiles where id = v_member) = 'pending', 'it starts pending, like an online application');

  -- Staff and members cannot write this audit row themselves.
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.expect_error(format('select public.log_office_registration(%L, %L)', v_member, '00000000-0000-0000-0000-0000000000f1'), '%permission denied%');
  perform t.as_user('00000000-0000-0000-0000-0000000000b1');
  perform t.expect_error(format('select public.log_office_registration(%L, %L)', v_member, '00000000-0000-0000-0000-0000000000b1'), '%permission denied%');
  perform t.as_owner();

  -- The Worker (service role) can, with a staff actor.
  execute 'set local role service_role';
  perform public.log_office_registration(v_member, '00000000-0000-0000-0000-0000000000f1');
  perform public.log_office_registration(v_member, '00000000-0000-0000-0000-0000000000f1');
  perform t.as_owner();
  perform t.assert((select count(*) from public.audit_logs where action = 'member.registered_in_office' and entity_id = v_member::text) = 1, 'a retry does not write a second row');

  perform t.as_user('00000000-0000-0000-0000-0000000000a1');
  perform t.assert(exists (select 1 from public.audit_feed where action = 'member.registered_in_office' and actor_name = 'Finance One' and subject_name = 'Walk In One'), 'the feed shows who registered whom');
  perform t.as_owner();
end $$;

-- The Worker cannot name a non-staff actor, or log a member who registered online.
do $$
begin
  perform t.as_owner();
  execute 'set local role service_role';
  perform t.expect_error(format('select public.log_office_registration(%L, %L)', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1'), '%must be office staff%');
  perform t.expect_error(format('select public.log_office_registration(%L, %L)', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1'), '%not registered by staff%');
  perform t.as_owner();
end $$;
