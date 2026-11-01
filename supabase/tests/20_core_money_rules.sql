-- Regression tests for the rules in migration 001 that protect money.

-- 1. A pending payment never touches the ledger or the balance.
do $$
declare v_pay uuid;
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b1');
  v_pay := public.create_payment('registration_fee', 'key-m1-registration-1');
  perform t.as_owner();
  perform t.assert((select status from public.payments where id = v_pay) = 'pending', 'payment should be pending');
  perform t.assert((select count(*) from public.ledger_transactions where member_id = '00000000-0000-0000-0000-0000000000b1') = 0,
                   'pending payment must not post to the ledger');
  perform t.assert((select status from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') = 'pending',
                   'member must stay pending until the fee is confirmed');
end $$;

-- 2. A retried request returns the same payment, not a second one.
do $$
declare v_a uuid; v_b uuid;
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b1');
  v_a := public.create_payment('registration_fee', 'key-m1-registration-1');
  v_b := public.create_payment('registration_fee', 'key-m1-registration-1');
  perform t.as_owner();
  perform t.assert(v_a = v_b, 'same idempotency key must return the same payment');
end $$;

-- 3. Members cannot confirm payments, not even their own.
do $$
declare v_pay uuid;
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b1');
  select id into v_pay from public.payments where member_id = '00000000-0000-0000-0000-0000000000b1';
  perform t.expect_error(format('select public.confirm_payment(%L)', v_pay), '%Not authorised%');
  perform t.as_owner();
end $$;

-- 4. Confirm needs the ID sighted first (002), then posts once, and is idempotent.
do $$
declare v_pay uuid; v_l1 uuid; v_l2 uuid;
begin
  perform t.as_owner();
  select id into v_pay from public.payments where member_id = '00000000-0000-0000-0000-0000000000b1';

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.expect_error(format('select public.confirm_payment(%L)', v_pay), '%national ID must be sighted%');
  perform t.as_owner();
  perform t.assert((select count(*) from public.ledger_transactions) = 0, 'failed confirm must leave no ledger rows');
  perform t.assert((select status from public.payments where id = v_pay) = 'pending', 'failed confirm must leave payment pending');

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform public.mark_id_sighted('00000000-0000-0000-0000-0000000000b1', '63-111111 A 11');
  v_l1 := public.confirm_payment(v_pay);
  v_l2 := public.confirm_payment(v_pay);
  perform t.as_owner();
  perform t.assert(v_l1 = v_l2, 'confirming twice must return the same ledger row');
  perform t.assert((select count(*) from public.ledger_transactions where payment_id = v_pay) = 1, 'ledger must hold exactly one row');
  perform t.assert((select status from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') = 'active', 'member should be active');
  perform t.assert((select fees_paid from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b1') = 20.00, 'fees_paid should be 20');
  perform t.assert((select confirmed_savings from public.member_balances where member_id = '00000000-0000-0000-0000-0000000000b1') = 0, 'a fee must never count as savings');
end $$;

-- 5. A provider amount that does not match is refused.
do $$
declare v_pay uuid;
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b2');
  v_pay := public.create_payment('registration_fee', 'key-m2-registration-1');
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.expect_error(format('select public.confirm_payment(%L, null, 19)', v_pay), '%Amount mismatch%');
  perform t.as_owner();
end $$;

-- 6. Members only see their own rows; visitors see no money data.
do $$
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000b2');
  perform t.assert((select count(*) from public.payments where member_id <> auth.uid()) = 0, 'member must not see others'' payments');
  perform t.assert((select count(*) from public.ledger_transactions) = 0, 'member2 has no ledger rows and must not see member1''s');
  perform t.assert((select count(*) from public.audit_logs) = 0, 'members must not read the audit log');
  perform t.as_user(null);
  perform t.assert((select count(*) from public.payments) = 0, 'visitors must see no payments');
  perform t.assert((select count(*) from public.profiles) = 0, 'visitors must see no profiles');
  perform t.as_owner();
end $$;

-- 7. Ledger and audit log are append-only.
do $$
begin
  perform t.expect_error('update public.ledger_transactions set amount = 1', '%append-only%');
  perform t.expect_error('delete from public.audit_logs', '%append-only%');
end $$;
