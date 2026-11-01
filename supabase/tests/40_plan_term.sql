-- Tests for migration 003: a plan of N weeks collects exactly N weekly contributions.
-- Runs after 30_office_payments.sql. Member Four and Member One are active with no plan.

-- 1. A 2-week plan collects 2 contributions: one week after joining and two weeks after.
do $$
declare v_plan uuid; v_ver uuid; v_enr uuid; v_due uuid; v_eff date;
begin
  perform t.as_owner();
  insert into public.savings_plans (name) values ('TEST two-week plan') returning id into v_plan;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 1, 'active', 5, 'weekly', 2, 'test terms') returning id into v_ver;

  perform t.as_user('00000000-0000-0000-0000-0000000000b4');
  v_enr := public.enroll_in_plan(v_ver, true);
  perform t.as_owner();
  select effective_date into v_eff from public.plan_enrollments where id = v_enr;
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 1, 'joining schedules the first contribution only');
  perform t.assert((select due_date from public.due_items where enrollment_id = v_enr) = v_eff + 7, 'first contribution is due one week after joining');

  -- First contribution paid: the second one (two weeks after joining) must now be scheduled.
  select id into v_due from public.due_items where enrollment_id = v_enr and due_date = v_eff + 7;
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.record_office_payment('00000000-0000-0000-0000-0000000000b4', 'savings_contribution', 'cash', 'R-4001', 'key-m4-term-0001', v_due);
  perform t.as_owner();
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 2, 'a 2-week plan must schedule its second contribution');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr and due_date = v_eff + 14 and status = 'scheduled') = 1, 'second contribution is due two weeks after joining');
  perform t.assert((select next_due_date from public.plan_enrollments where id = v_enr) = v_eff + 14, 'enrolment points at the second contribution');

  -- Second contribution paid: the plan is complete, nothing further is scheduled.
  select id into v_due from public.due_items where enrollment_id = v_enr and due_date = v_eff + 14;
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.record_office_payment('00000000-0000-0000-0000-0000000000b4', 'savings_contribution', 'cash', 'R-4002', 'key-m4-term-0002', v_due);
  perform t.as_owner();
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 2, 'nothing is scheduled after the last contribution');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr and status = 'paid') = 2, 'both contributions are paid');
  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b4') = 10, 'two contributions of 5 = 10 saved');
end $$;

-- 2. A 1-week plan collects exactly 1 contribution (the boundary case).
do $$
declare v_plan uuid; v_ver uuid; v_enr uuid; v_due uuid;
begin
  perform t.as_owner();
  insert into public.savings_plans (name) values ('TEST one-week plan') returning id into v_plan;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 1, 'active', 5, 'weekly', 1, 'test terms') returning id into v_ver;

  perform t.as_user('00000000-0000-0000-0000-0000000000b1');
  v_enr := public.enroll_in_plan(v_ver, true);
  perform t.as_owner();
  select id into v_due from public.due_items where enrollment_id = v_enr;
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.record_office_payment('00000000-0000-0000-0000-0000000000b1', 'savings_contribution', 'cash', 'R-4003', 'key-m1-term-0001', v_due);
  perform t.as_owner();
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 1, 'a 1-week plan collects exactly one contribution');
end $$;

-- 3. An open-ended plan keeps scheduling, as before.
do $$
declare v_plan uuid; v_ver uuid; v_enr uuid; v_due uuid; v_m uuid := '00000000-0000-0000-0000-0000000000b9';
begin
  perform t.as_owner();
  insert into auth.users (id, email, raw_user_meta_data)
    values (v_m, 'openended@test.local', '{"full_name":"Open Ended","phone":"+263771000009"}');
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.mark_id_sighted(v_m, '80-111111 D 80');
  perform public.record_office_payment(v_m, 'registration_fee', 'cash', 'R-4100', 'key-m9-registration-1');

  perform t.as_owner();
  insert into public.savings_plans (name) values ('TEST open-ended plan') returning id into v_plan;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 1, 'active', 5, 'weekly', null, 'test terms') returning id into v_ver;

  perform t.as_user(v_m);
  v_enr := public.enroll_in_plan(v_ver, true);
  perform t.as_owner();
  for i in 1..3 loop
    select id into v_due from public.due_items where enrollment_id = v_enr and status = 'scheduled';
    perform t.as_user('00000000-0000-0000-0000-0000000000f1');
    perform public.record_office_payment(v_m, 'savings_contribution', 'cash', 'R-420' || i, 'key-m9-term-000' || i, v_due);
    perform t.as_owner();
  end loop;
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 4, 'an open-ended plan always has the next contribution scheduled');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr and status = 'scheduled') = 1, 'exactly one contribution is waiting');
end $$;
