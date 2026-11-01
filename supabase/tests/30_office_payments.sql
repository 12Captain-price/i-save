-- Tests for migration 002: identity, office payments, receipts, currency, daily report.
-- Uses the users created in 10_helpers_and_users.sql.

-- 1. Sign-up trigger: consents, registration channel and ID are captured safely.
do $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (v_id, 'claims@test.local',
     '{"full_name":"Claims","phone":"+263772000001","national_id":"70-222222 b 22","age_confirmed":"true","terms_accepted":"true","registered_via":"staff"}',
     '{}');
  perform t.assert((select registered_via from public.profiles where id = v_id) = 'online',
                   'a member must not be able to claim registered_via = staff');
  perform t.assert((select age_confirmed_at from public.profiles where id = v_id) is not null, 'age consent should be stamped');
  perform t.assert((select terms_accepted_at from public.profiles where id = v_id) is not null, 'terms consent should be stamped');
  perform t.assert((select national_id from public.member_identity where member_id = v_id) = '70222222B22', 'ID should be normalised');

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (gen_random_uuid(), 'walkin@test.local', '{"full_name":"Walk In","phone":"+263772000002"}', '{"registered_via":"staff"}');
  perform t.assert((select registered_via from public.profiles where email = 'walkin@test.local') = 'staff',
                   'service role should be able to mark a staff registration');
end $$;

-- 2. One person = one account.
do $$
begin
  perform t.expect_error($q$insert into auth.users (email, raw_user_meta_data)
                           values ('dupe-phone@test.local', '{"phone":"+263771000001"}')$q$, '%profiles_phone_uq%');
  perform t.expect_error($q$insert into auth.users (email, raw_user_meta_data)
                           values ('dupe-id@test.local', '{"national_id":"70-222222-B-22"}')$q$, '%member_identity_national_id_key%');
end $$;

-- 3. Members cannot touch verification fields or read the ID table.
do $$
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b3');
  perform t.expect_error($q$update public.profiles set id_sighted_at = now() where id = auth.uid()$q$, '%cannot change%');
  perform t.expect_error($q$update public.profiles set terms_accepted_at = now() where id = auth.uid()$q$, '%cannot change%');
  perform t.expect_error($q$select * from public.member_identity$q$, '%permission denied%');
  perform t.expect_error($q$select public.get_member_national_id('00000000-0000-0000-0000-0000000000b4')$q$, '%Not authorised%');
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b3','registration_fee','cash','R-0001','key-by-member-0001')$q$, '%Not authorised%');
  perform t.as_owner();
end $$;

-- 4. Registration at the office needs the ID sighted first.
do $$
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b3','registration_fee','cash','R-1001','key-m3-registration-1')$q$,
                         '%Sight the member%national ID first%');
  -- The ID number is required the first time.
  perform t.expect_error($q$select public.mark_id_sighted('00000000-0000-0000-0000-0000000000b3')$q$, '%Enter the ID number%');
  perform public.mark_id_sighted('00000000-0000-0000-0000-0000000000b3', '63-123456 A 42');
  -- Another member cannot be given the same ID.
  perform t.expect_error($q$select public.mark_id_sighted('00000000-0000-0000-0000-0000000000b4', '63123456A42')$q$, '%already registered%');
  -- Staff cannot verify themselves.
  perform t.expect_error($q$select public.mark_id_sighted('00000000-0000-0000-0000-0000000000f1', '99-999999 Z 99')$q$, '%own ID%');
  perform t.as_owner();
  perform t.assert((select id_sighted_by from public.profiles where id = '00000000-0000-0000-0000-0000000000b3') = '00000000-0000-0000-0000-0000000000f1', 'sighting should record who');
  perform t.assert((select count(*) from public.audit_logs where action = 'id.sighted') >= 1, 'sighting must be audited');
  perform t.assert((select count(*) from public.audit_logs where details::text ilike '%123456%') = 0, 'the ID number must never be written to the audit log');
end $$;

-- 5. Viewing an ID is staff only and audited; members can read their own without an audit row.
do $$
declare v_before int; v_nid text;
begin
  perform t.as_owner();
  select count(*) into v_before from public.audit_logs where action = 'id.viewed';
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  v_nid := public.get_member_national_id('00000000-0000-0000-0000-0000000000b3');
  perform t.as_owner();
  perform t.assert(v_nid = '63123456A42', 'staff should read the normalised ID');
  perform t.assert((select count(*) from public.audit_logs where action = 'id.viewed') = v_before + 1, 'staff view must be audited');

  perform t.as_user('00000000-0000-0000-0000-0000000000b3');
  v_nid := public.get_member_national_id('00000000-0000-0000-0000-0000000000b3');
  perform t.as_owner();
  perform t.assert(v_nid = '63123456A42', 'member should read their own ID');
  perform t.assert((select count(*) from public.audit_logs where action = 'id.viewed') = v_before + 1, 'a member viewing their own ID is not audited');
end $$;

-- 6. The registration fee at the office: one step, one ledger row, one receipt, safe to retry.
do $$
declare v_r1 jsonb; v_r2 jsonb;
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  v_r1 := public.record_office_payment('00000000-0000-0000-0000-0000000000b3', 'registration_fee', 'cash', 'R-1001', 'key-m3-registration-1');
  v_r2 := public.record_office_payment('00000000-0000-0000-0000-0000000000b3', 'registration_fee', 'cash', 'R-1001', 'key-m3-registration-1');
  perform t.as_owner();
  perform t.assert((v_r1->>'already_recorded')::boolean = false, 'first call should record');
  perform t.assert((v_r2->>'already_recorded')::boolean = true, 'retry should be recognised');
  perform t.assert(v_r1->>'receipt_number' = v_r2->>'receipt_number', 'retry must return the same receipt');
  perform t.assert((select count(*) from public.ledger_transactions where member_id = '00000000-0000-0000-0000-0000000000b3') = 1, 'exactly one ledger row');
  perform t.assert((select count(*) from public.receipts where member_id = '00000000-0000-0000-0000-0000000000b3') = 1, 'exactly one receipt');
  perform t.assert((select status from public.profiles where id = '00000000-0000-0000-0000-0000000000b3') = 'active', 'member should now be active');
  perform t.assert((select fees_paid from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b3') = 20.00, 'fees should be 20');
  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b3') = 0, 'fees must not count as savings');
  perform t.assert((select provider from public.payments where id = (v_r1->>'payment_id')::uuid) = 'office_cash', 'provider should be office_cash');
  perform t.assert((select confirmed_by from public.payments where id = (v_r1->>'payment_id')::uuid) = '00000000-0000-0000-0000-0000000000f1', 'confirmed_by should be the staff member');
  perform t.assert((select recorded_by from public.payments where id = (v_r1->>'payment_id')::uuid) = '00000000-0000-0000-0000-0000000000f1', 'recorded_by should be the staff member');
  perform t.assert((select office_receipt_no from public.receipts where id = (v_r1->>'receipt_id')::uuid) = 'R-1001', 'paper receipt number should be on the receipt');
  perform t.assert((select count(*) from public.audit_logs where action = 'office_payment.recorded') = 1, 'office payment must be audited once');
  perform t.assert((select count(*) from public.notifications where member_id = '00000000-0000-0000-0000-0000000000b3' and event = 'payment_confirmed') >= 1, 'member should be notified');
end $$;

-- 7. Guard rails on office payments.
do $$
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  -- A paper receipt number can only be used once.
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b4','registration_fee','cash','R-1001','key-m4-registration-1')$q$, '%already been used%');
  -- Staff cannot take a payment for themselves.
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000f1','registration_fee','cash','R-1002','key-self-registration-1')$q$, '%for themselves%');
  -- Bad method and missing receipt number.
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b4','registration_fee','ecocash','R-1003','key-m4-registration-2')$q$, '%cash or bank_transfer%');
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b4','registration_fee','cash','  ','key-m4-registration-3')$q$, '%receipt number%');
  -- Registration cannot be paid twice.
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b3','registration_fee','cash','R-1004','key-m3-registration-2')$q$, '%already exists%');
  -- A member who is not active yet cannot pay contributions or subscriptions.
  perform t.expect_error($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b4','monthly_subscription','cash','R-1005','key-m4-subscription-1')$q$, '%not active yet%');
  perform t.as_owner();
  perform t.assert((select count(*) from public.ledger_transactions) = 2, 'rejected attempts must leave no ledger rows (member1 and member3 fees only)');
end $$;

-- 8. Savings contribution through the office; the server sets the amount.
do $$
declare v_plan uuid; v_ver uuid; v_enr uuid; v_due uuid; v_res jsonb;
begin
  perform t.as_owner();
  insert into public.savings_plans (name) values ('TEST plan') returning id into v_plan;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 1, 'active', 10, 'weekly', 12, 'test terms') returning id into v_ver;

  perform t.as_user('00000000-0000-0000-0000-0000000000b3');
  v_enr := public.enroll_in_plan(v_ver, true);
  perform t.as_owner();
  select id into v_due from public.due_items where enrollment_id = v_enr;

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  v_res := public.record_office_payment('00000000-0000-0000-0000-0000000000b3', 'savings_contribution', 'cash', 'R-2001',
                                        'key-m3-contribution-1', v_due, null, 5000);
  perform t.expect_error(format($q$select public.record_office_payment('00000000-0000-0000-0000-0000000000b3','savings_contribution','cash','R-2002','key-m3-contribution-2',%L)$q$, v_due),
                         '%not found or already paid%');
  perform t.as_owner();
  perform t.assert((select amount from public.payments where id = (v_res->>'payment_id')::uuid) = 10, 'the plan sets the amount, not the client (5000 ignored)');
  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b3') = 10, 'savings should be 10');
  perform t.assert((select fees_paid from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b3') = 20, 'fees stay separate at 20');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr and status = 'scheduled') = 1, 'next weekly contribution should be scheduled');
end $$;

-- 9. Receipts: members see their own only; receipts cannot be changed.
do $$
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b3');
  perform t.assert((select count(*) from public.member_receipts) = 2, 'member3 should see their two receipts');
  perform t.as_user('00000000-0000-0000-0000-0000000000b2');
  perform t.assert((select count(*) from public.member_receipts) = 0, 'member2 must not see member3''s receipts');
  perform t.as_user(null);
  perform t.expect_error('select * from public.member_receipts', '%permission denied%');
  perform t.as_owner();
  perform t.expect_error('update public.receipts set amount = 1', '%append-only%');
  perform t.expect_error('delete from public.receipts', '%append-only%');
end $$;

-- 10. Only enabled currencies are accepted, and an account cannot be activated without ID sighting.
do $$
begin
  perform t.as_owner();
  perform t.expect_error($q$insert into public.payments (member_id, purpose, amount, currency, idempotency_key)
                           values ('00000000-0000-0000-0000-0000000000b4','registration_fee',20,'ZWG','key-zig-0001')$q$, '%ZWG are not enabled%');
  perform t.expect_error($q$update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000b4'$q$, '%national ID must be sighted%');
end $$;

-- 11. Reversing a contribution brings savings back; the receipt stays on record as reversed.
do $$
declare v_led uuid;
begin
  perform t.as_owner();
  select l.id into v_led from public.ledger_transactions l
   where l.member_id = '00000000-0000-0000-0000-0000000000b3' and l.type = 'savings_contribution';
  perform t.as_user('00000000-0000-0000-0000-0000000000a1');
  perform public.reverse_ledger_transaction(v_led, 'Entered against wrong member');
  perform t.as_owner();
  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b3') = 0, 'savings back to 0');
  perform t.assert((select reversed from public.member_receipts where office_receipt_no = 'R-2001'), 'receipt should show as reversed');
  perform t.assert((select count(*) from public.receipts where office_receipt_no = 'R-2001') = 1, 'the receipt itself must remain');
end $$;

-- 12. Daily report: totals per staff member, cut on the Zimbabwe calendar day.
do $$
declare v_today date := (now() at time zone 'Africa/Harare')::date;
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.assert((select payments_count from public.staff_daily_report
                     where staff_id = '00000000-0000-0000-0000-0000000000f1' and report_date = v_today and currency = 'USD') = 2, 'two confirmed payments: member1 online fee and member3 office fee');
  perform t.assert((select total_amount   from public.staff_daily_report where staff_id = '00000000-0000-0000-0000-0000000000f1' and report_date = v_today) = 40, 'total 40');
  perform t.assert((select cash_total     from public.staff_daily_report where staff_id = '00000000-0000-0000-0000-0000000000f1' and report_date = v_today) = 20, 'cash 20 (member3 at the office)');
  perform t.assert((select other_total    from public.staff_daily_report where staff_id = '00000000-0000-0000-0000-0000000000f1' and report_date = v_today) = 20, 'other 20 (member1 verified online payment)');
  perform t.assert((select reversed_count from public.staff_daily_report where staff_id = '00000000-0000-0000-0000-0000000000f1' and report_date = v_today) = 1, 'one reversed payment shown separately');
  perform t.assert((select reversed_total from public.staff_daily_report where staff_id = '00000000-0000-0000-0000-0000000000f1' and report_date = v_today) = 10, 'reversed total 10');
  perform t.as_user('00000000-0000-0000-0000-0000000000b3');
  perform t.assert((select count(*) from public.staff_daily_report) = 0, 'members must not see the staff report');
  perform t.as_owner();
end $$;

-- 13. Sign-off: admin only, not your own day, once per day.
do $$
declare v_today date := (now() at time zone 'Africa/Harare')::date; v_id uuid;
begin
  -- A person who is both finance and admin records a payment of their own.
  perform t.as_owner();
  perform t.as_user('00000000-0000-0000-0000-0000000000f2');
  -- member4 needs an ID sighted by someone else first
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.mark_id_sighted('00000000-0000-0000-0000-0000000000b4', '75-654321 C 75');
  perform t.as_user('00000000-0000-0000-0000-0000000000f2');
  perform public.record_office_payment('00000000-0000-0000-0000-0000000000b4', 'registration_fee', 'bank_transfer', 'R-3001', 'key-m4-registration-9');

  perform t.expect_error(format($q$select public.sign_off_daily_report(%L, '00000000-0000-0000-0000-0000000000f2')$q$, v_today), '%cannot sign off your own day%');

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.expect_error(format($q$select public.sign_off_daily_report(%L, '00000000-0000-0000-0000-0000000000f2')$q$, v_today), '%Only an admin%');

  perform t.as_user('00000000-0000-0000-0000-0000000000a1');
  v_id := public.sign_off_daily_report(v_today, '00000000-0000-0000-0000-0000000000f2', 'Checked against receipt book');
  perform t.expect_error(format($q$select public.sign_off_daily_report(%L, '00000000-0000-0000-0000-0000000000f2')$q$, v_today), '%already been signed off%');
  perform t.expect_error(format($q$select public.sign_off_daily_report(%L, '00000000-0000-0000-0000-0000000000f2')$q$, v_today - 30), '%nothing to sign off%');
  perform t.as_owner();
  perform t.assert((select totals->0->>'bank_total' from public.daily_signoffs where id = v_id) = '20.00', 'sign-off must snapshot the totals');
  perform t.expect_error('update public.daily_signoffs set note = ''x''', '%append-only%');
end $$;
