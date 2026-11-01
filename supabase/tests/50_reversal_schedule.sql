-- Tests for migration 004: reversing a payment puts back what it settled.
-- Runs after 40_plan_term.sql. Member Four has a finished 2-week plan (2 x 5 paid, savings 10).

-- 1. Reversing the LAST contribution reopens it, and the plan can collect it again.
do $$
declare v_enr uuid; v_eff date; v_led uuid; v_due uuid;
begin
  perform t.as_owner();
  select id, effective_date into v_enr, v_eff from public.plan_enrollments
   where member_id = '00000000-0000-0000-0000-0000000000b4' and status = 'active';
  select l.id into v_led from public.ledger_transactions l
    join public.due_items d on d.id = (select due_item_id from public.payments where id = l.payment_id)
   where l.member_id = '00000000-0000-0000-0000-0000000000b4' and l.type = 'savings_contribution'
     and d.due_date = v_eff + 14;

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.reverse_ledger_transaction(v_led, 'Wrong amount handed over');
  perform t.as_owner();

  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b4') = 5, 'savings fall to 5');
  select id into v_due from public.due_items where enrollment_id = v_enr and due_date = v_eff + 14;
  perform t.assert((select status from public.due_items where id = v_due) in ('scheduled', 'due'), 'the reversed contribution is owed again');
  perform t.assert((select next_due_date from public.plan_enrollments where id = v_enr) = v_eff + 14, 'next due date points at it');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 2, 'no extra due items were created');

  -- It can be paid again with a new receipt, and the plan is complete again.
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.record_office_payment('00000000-0000-0000-0000-0000000000b4', 'savings_contribution', 'cash', 'R-5001', 'key-m4-rev-0001', v_due);
  perform t.as_owner();
  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b4') = 10, 'savings back to 10');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr and status = 'paid') = 2, 'both contributions paid again');
  perform t.assert((select count(*) from public.due_items where enrollment_id = v_enr) = 2, 'still nothing scheduled past the term');
end $$;

-- 2. Reversing the FIRST contribution reopens it; the next due date goes to the earliest owed.
do $$
declare v_enr uuid; v_eff date; v_led uuid;
begin
  perform t.as_owner();
  select id, effective_date into v_enr, v_eff from public.plan_enrollments
   where member_id = '00000000-0000-0000-0000-0000000000b4' and status = 'active';
  select l.id into v_led from public.ledger_transactions l
    join public.payments p on p.id = l.payment_id
    join public.due_items d on d.id = p.due_item_id
   where l.member_id = '00000000-0000-0000-0000-0000000000b4' and l.type = 'savings_contribution'
     and d.due_date = v_eff + 7 and p.office_receipt_no = 'R-4001';
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.reverse_ledger_transaction(v_led, 'Entered against wrong member');
  perform t.as_owner();
  perform t.assert((select status from public.due_items where enrollment_id = v_enr and due_date = v_eff + 7) in ('scheduled', 'due'), 'first contribution owed again');
  perform t.assert((select next_due_date from public.plan_enrollments where id = v_enr) = v_eff + 7, 'next due date is the earliest owed');
  perform t.assert((select status from public.due_items where enrollment_id = v_enr and due_date = v_eff + 14) = 'paid', 'the later paid contribution is untouched');
end $$;

-- 3. A reversal is still once only, and the audit row says what was put back.
do $$
declare v_led uuid;
begin
  perform t.as_owner();
  select l.reverses_id into v_led from public.ledger_transactions l
   where l.member_id = '00000000-0000-0000-0000-0000000000b4' and l.type = 'reversal' limit 1;
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.expect_error(format('select public.reverse_ledger_transaction(%L, %L)', v_led, 'Trying a second time'), '%already been reversed%');
  perform t.as_owner();
  perform t.assert((select count(*) from public.audit_logs where action = 'ledger.reversed' and (details->>'due_item_reinstated')::boolean) >= 2, 'audit records the reinstated contributions');
end $$;

-- 4. Reversing a subscription payment reopens its invoice.
do $$
declare v_inv uuid; v_led uuid; v_status text;
begin
  perform t.as_owner();
  insert into public.subscription_invoices (member_id, period_start, period_end, due_date, amount, currency)
    values ('00000000-0000-0000-0000-0000000000b1', date '2031-01-01', date '2031-01-31', date '2031-01-01', 5, 'USD')
    returning id into v_inv;
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.record_office_payment('00000000-0000-0000-0000-0000000000b1', 'monthly_subscription', 'cash', 'R-5100', 'key-m1-inv-0001', null, v_inv);
  perform t.as_owner();
  perform t.assert((select status from public.subscription_invoices where id = v_inv) = 'paid', 'invoice paid');
  select l.id into v_led from public.ledger_transactions l join public.payments p on p.id = l.payment_id where p.invoice_id = v_inv;
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.reverse_ledger_transaction(v_led, 'Cheque bounced at the bank');
  perform t.as_owner();
  select status::text into v_status from public.subscription_invoices where id = v_inv;
  perform t.assert(v_status = 'open', 'a future-dated invoice goes back to open, got ' || v_status);
end $$;

-- 5. Reversing a registration fee changes the money only. The member stays active.
do $$
declare v_led uuid;
begin
  perform t.as_owner();
  select l.id into v_led from public.ledger_transactions l
   where l.member_id = '00000000-0000-0000-0000-0000000000b4' and l.type = 'registration_fee';
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.reverse_ledger_transaction(v_led, 'Registration fee taken twice');
  perform t.as_owner();
  perform t.assert((select status from public.profiles where id = '00000000-0000-0000-0000-0000000000b4') = 'active', 'member status is not touched by a fee reversal');
end $$;
