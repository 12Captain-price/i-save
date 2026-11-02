-- Tests for migration 011: withdrawals.
-- Runs after 90_staff_admin_mode.sql. Uses two new members (e1, e2) so earlier fixtures stay untouched.
-- admin = a1, finance = f1, finance+admin = f2.

-- Set-up: two active members, each with savings of 60 and a plan.
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  v_plan uuid; v_short uuid; v_12 uuid; v_24 uuid;
begin
  perform t.as_owner();
  insert into auth.users (id, email, raw_user_meta_data) values
    (e1, 'wd1@test.local', '{"full_name":"Withdraw One","phone":"+263779000001"}'),
    (e2, 'wd2@test.local', '{"full_name":"Withdraw Two","phone":"+263779000002"}');
  update public.profiles set id_sighted_at = now(), status = 'active' where id in (e1, e2);

  insert into public.savings_plans (name) values ('TEST withdrawal plans') returning id into v_plan;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 1, 'active', 5, 'weekly', 12, 'test') returning id into v_12;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 2, 'active', 5, 'weekly', 24, 'test') returning id into v_24;
  insert into public.savings_plan_versions (plan_id, version, status, contribution_amount, frequency, duration_weeks, terms_text)
    values (v_plan, 3, 'active', 5, 'weekly', 4, 'test') returning id into v_short;

  perform t.as_user(e1); perform public.enroll_in_plan(v_12, true);
  perform t.as_user(e2); perform public.enroll_in_plan(v_24, true);
  perform t.as_owner();

  -- Seed savings as an approved adjustment (a payment-type row would need a real payment and receipt).
  insert into public.ledger_transactions (member_id, type, amount, savings_delta, currency, reason)
    values (e1, 'approved_adjustment', 60, 60, 'USD', 'TEST seed savings'),
           (e2, 'approved_adjustment', 60, 60, 'USD', 'TEST seed savings');
end $$;

-- 1. Switched off by default: nobody can request, and nothing is written.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1';
begin
  perform t.as_user(e1);
  perform t.assert((select eligible from public.withdrawal_quote(e1)) = false, 'quote must say not eligible while switched off');
  perform t.expect_error($q$select public.request_withdrawal('cash', null, null, true)$q$, '%not open yet%');
  perform t.as_owner();
  perform t.assert((select count(*) from public.withdrawal_requests) = 0, 'no request may exist while switched off');
end $$;

-- 2. Members cannot write the table directly, even when switched on.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1';
begin
  perform t.as_owner();
  update public.system_settings set value = 'true'::jsonb where key = 'withdrawals_enabled';
  perform t.as_user(e1);
  perform t.expect_error(format($q$insert into public.withdrawal_requests (member_id, amount, currency) values (%L, 60, 'USD')$q$, e1), '%permission denied%');
  perform t.as_owner();
end $$;

-- 3. Plan still running and early exit not allowed: not eligible.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1';
begin
  perform t.as_user(e1);
  perform t.assert((select eligible from public.withdrawal_quote(e1)) = false, 'running plan: not eligible');
  perform t.expect_error($q$select public.request_withdrawal('cash', null, null, true)$q$, '%open when your plan ends%');
  perform t.as_owner();
end $$;

-- 4. Plan has ended: eligible for the full balance, no fee.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; q record;
begin
  perform t.as_owner();
  update public.plan_enrollments set effective_date = current_date - 100 where member_id = e1;
  perform t.as_user(e1);
  select * into q from public.withdrawal_quote(e1);
  perform t.assert(q.eligible, 'ended plan: eligible');
  perform t.assert(q.amount = 60 and q.fee_amount = 0 and q.net_amount = 60 and q.early_exit = false, 'full balance, no fee, not early');
  perform t.as_owner();
end $$;

-- 5. Request validation.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1';
begin
  perform t.as_user(e1);
  perform t.expect_error($q$select public.request_withdrawal('cash', null, null, false)$q$, '%must confirm%');
  perform t.expect_error($q$select public.request_withdrawal('bitcoin', null, null, true)$q$, '%not available%');
  perform t.expect_error($q$select public.request_withdrawal('ecocash', '0771234567', 'Withdraw One', true)$q$, '%+263 format%');
  perform t.expect_error($q$select public.request_withdrawal('ecocash', '+263779000001', '', true)$q$, '%registered in%');
  perform t.as_owner();
  perform t.assert((select count(*) from public.withdrawal_requests) = 0, 'failed validation must leave nothing behind');
end $$;

-- 6. A valid request is recorded, audited, and moves no money. A second one is refused.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; v_id uuid;
begin
  perform t.as_user(e1);
  v_id := public.request_withdrawal('ecocash', '+263779000001', 'Withdraw One', true, 'please');
  perform t.expect_error($q$select public.request_withdrawal('cash', null, null, true)$q$, '%already have a withdrawal request%');
  perform t.as_owner();
  perform t.assert((select status from public.withdrawal_requests where id = v_id) = 'requested', 'status requested');
  perform t.assert((select amount from public.withdrawal_requests where id = v_id) = 60, 'amount is the full balance');
  perform t.assert((select confirmed_savings from public.member_balances where member_id = e1) = 60, 'a request must not move money');
  perform t.assert((select count(*) from public.audit_logs where action = 'withdrawal.requested' and entity_id = v_id::text) = 1, 'request audited');
end $$;

-- 7. Two-person rule.
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1'; v_id uuid;
  a1 uuid := '00000000-0000-0000-0000-0000000000a1';
  f1 uuid := '00000000-0000-0000-0000-0000000000f1';
  f2 uuid := '00000000-0000-0000-0000-0000000000f2';
begin
  select id into v_id from public.withdrawal_requests where member_id = e1;

  -- A member cannot move their own request along.
  perform t.as_user(e1);
  perform t.expect_error(format('select public.review_withdrawal(%L)', v_id), '%Not authorised%');
  perform t.expect_error(format('select public.approve_withdrawal(%L)', v_id), '%Only an administrator%');
  perform t.expect_error(format('select public.record_withdrawal_payout(%L, %L)', v_id, 'REF-001'), '%Not authorised%');

  -- Approval needs a review first.
  perform t.as_user(a1);
  perform t.expect_error(format('select public.approve_withdrawal(%L)', v_id), '%under review%');

  -- Finance staff and admins can review; the reviewer cannot also approve.
  perform t.as_user(f2);
  perform public.review_withdrawal(v_id);
  perform t.expect_error(format('select public.approve_withdrawal(%L)', v_id), '%different person%');

  -- Finance-only staff cannot approve (admin mode is off for f1 in this test).
  perform t.as_owner();
  delete from public.staff_admin_mode where user_id = f1;
  perform t.as_user(f1);
  perform t.expect_error(format('select public.approve_withdrawal(%L)', v_id), '%Only an administrator%');

  -- A different admin can.
  perform t.as_user(a1);
  perform public.approve_withdrawal(v_id);
  perform t.as_owner();
  perform t.assert((select status from public.withdrawal_requests where id = v_id) = 'approved', 'approved');
  perform t.assert((select reviewed_by from public.withdrawal_requests where id = v_id) = f2, 'reviewer recorded');
  perform t.assert((select approved_by from public.withdrawal_requests where id = v_id) = a1, 'approver recorded');
end $$;

-- 8. Payout posts exactly one ledger row, closes the plan, and is safe to retry.
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1'; v_id uuid; l1 uuid; l2 uuid;
  f1 uuid := '00000000-0000-0000-0000-0000000000f1';
begin
  select id into v_id from public.withdrawal_requests where member_id = e1;
  perform t.as_user(f1);
  perform t.expect_error(format('select public.record_withdrawal_payout(%L, %L)', v_id, 'x'), '%payout reference%');
  l1 := public.record_withdrawal_payout(v_id, 'ECO-12345');
  l2 := public.record_withdrawal_payout(v_id, 'ECO-12345');
  perform t.expect_error(format('select public.reject_withdrawal(%L, %L)', v_id, 'too late now'), '%Only an administrator%');
  perform t.as_owner();
  perform t.assert(l1 = l2, 'retrying a payout returns the same ledger row');
  perform t.assert((select count(*) from public.ledger_transactions where member_id = e1 and type = 'withdrawal') = 1, 'exactly one withdrawal row');
  perform t.assert((select confirmed_savings from public.member_balances where member_id = e1) = 0, 'savings back to zero');
  perform t.assert((select status from public.withdrawal_requests where id = v_id) = 'paid', 'status paid');
  perform t.assert((select status from public.plan_enrollments where member_id = e1 order by created_at desc limit 1) = 'closed', 'plan closed after payout');
  perform t.assert((select count(*) from public.due_items where member_id = e1 and status in ('scheduled', 'due')) = 0, 'no contributions left to collect');
  perform t.assert((select count(*) from public.audit_logs where action = 'withdrawal.paid' and entity_id = v_id::text) = 1, 'payout audited');
  -- The ledger stays append-only and the request is final.
  perform t.expect_error(format($q$update public.withdrawal_requests set status = 'requested' where id = %L$q$, v_id), '%cannot change status%');
  perform t.expect_error(format($q$update public.ledger_transactions set amount = 1 where id = %L$q$, l1), '%append-only%');
end $$;

-- 9. Early exit: off by default; when on, needs 12 weeks elapsed and shows the fee.
do $$
declare e2 uuid := '00000000-0000-0000-0000-0000000000e2'; q record;
begin
  perform t.as_owner();
  update public.plan_enrollments set effective_date = current_date - 90 where member_id = e2;  -- 24-week plan, ~13 weeks in
  perform t.as_user(e2);
  perform t.assert((select eligible from public.withdrawal_quote(e2)) = false, 'early exit off: not eligible');

  perform t.as_owner();
  update public.system_settings set value = 'true'::jsonb where key = 'withdrawal_early_exit_allowed';
  update public.system_settings set value = '"10"'::jsonb where key = 'withdrawal_early_exit_fee_percent';
  perform t.as_user(e2);
  select * into q from public.withdrawal_quote(e2);
  perform t.assert(q.eligible and q.early_exit, 'early exit on: eligible and flagged early');
  perform t.assert(q.amount = 60 and q.fee_amount = 6.00 and q.net_amount = 54.00, 'fee is 10% of savings, shown before confirming');

  -- Before 12 weeks have passed, even early exit is refused.
  perform t.as_owner();
  update public.plan_enrollments set effective_date = current_date - 30 where member_id = e2;
  perform t.as_user(e2);
  perform t.assert((select eligible from public.withdrawal_quote(e2)) = false, 'under 12 weeks: not eligible');
  perform t.as_owner();
  update public.plan_enrollments set effective_date = current_date - 90 where member_id = e2;
end $$;

-- 10. An overdue subscription blocks a request; clearing it unblocks.
do $$
declare e2 uuid := '00000000-0000-0000-0000-0000000000e2'; v_inv uuid;
begin
  perform t.as_owner();
  insert into public.subscription_invoices (member_id, period_start, period_end, due_date, amount, currency, status)
    values (e2, current_date - 60, current_date - 31, current_date - 30, 5, 'USD', 'open') returning id into v_inv;
  perform t.as_user(e2);
  perform t.expect_error($q$select public.request_withdrawal('cash', null, null, true)$q$, '%overdue subscription%');
  perform t.as_owner();
  update public.subscription_invoices set status = 'paid' where id = v_inv;
end $$;

-- 11. Early exit request: fee is kept, paid out net, rejection and cancellation work.
do $$
declare
  e2 uuid := '00000000-0000-0000-0000-0000000000e2'; v_id uuid; v_id2 uuid;
  a1 uuid := '00000000-0000-0000-0000-0000000000a1';
  f1 uuid := '00000000-0000-0000-0000-0000000000f1';
  f2 uuid := '00000000-0000-0000-0000-0000000000f2';
begin
  perform t.as_user(e2);
  v_id := public.request_withdrawal('cash', null, null, true);
  perform t.as_owner();
  perform t.assert((select early_exit and fee_amount = 6.00 and net_amount = 54.00 from public.withdrawal_requests where id = v_id), 'early request stores the fee');

  -- Member cancels, then asks again.
  perform t.as_user(e2);
  perform public.cancel_withdrawal(v_id);
  perform t.expect_error(format('select public.cancel_withdrawal(%L)', v_id), '%can no longer be cancelled%');
  v_id2 := public.request_withdrawal('cash', null, null, true);

  -- Reject needs a reason and an admin; the member is told why.
  perform t.as_user(a1);
  perform t.expect_error(format('select public.reject_withdrawal(%L, %L)', v_id2, 'no'), '%reason%');
  perform public.reject_withdrawal(v_id2, 'Plan terms not met');
  perform t.as_owner();
  perform t.assert((select status from public.withdrawal_requests where id = v_id2) = 'rejected', 'rejected');
  perform t.assert((select count(*) from public.notifications where member_id = e2 and event = 'withdrawal_rejected') >= 1, 'member told about the rejection');

  -- Ask again, go through the whole flow, check the fee lands in the ledger.
  perform t.as_user(e2);
  v_id := public.request_withdrawal('cash', null, null, true);
  perform t.as_user(f2); perform public.review_withdrawal(v_id);
  perform t.as_user(a1); perform public.approve_withdrawal(v_id);
  perform t.as_user(f1); perform public.record_withdrawal_payout(v_id, 'CASH-0001');
  perform t.as_owner();
  perform t.assert((select confirmed_savings from public.member_balances where member_id = e2) = 0, 'all savings left the balance');
  perform t.assert((select fees_paid from public.member_balances where member_id = e2) = 6.00, 'the early-exit fee shows as a fee, not savings');
  perform t.assert((select status from public.plan_enrollments where member_id = e2 order by created_at desc limit 1) = 'closed', 'early exit closes the plan');
  perform t.assert((select count(*) from public.ledger_transactions where member_id = e2 and type = 'withdrawal') = 1, 'one withdrawal row');
end $$;

-- 12. Reusing a payout reference is refused.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; v_ref text;
begin
  perform t.as_owner();
  select payout_reference into v_ref from public.withdrawal_requests where member_id = e1 and status = 'paid';
  perform t.assert(v_ref = 'ECO-12345', 'reference stored');
  begin
    update public.withdrawal_requests set payout_reference = v_ref where member_id = '00000000-0000-0000-0000-0000000000e2' and status = 'paid';
    raise exception 'TEST FAILED: duplicate payout reference accepted';
  exception when unique_violation then null;
  end;
end $$;
