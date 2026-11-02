-- Tests for migration 012: withdrawal receipts and the record of who did what.
-- Runs after 95_withdrawals.sql: member e1 and member e2 each have a PAID withdrawal.
-- e1: reviewed by f2 (Finance And Admin), approved by a1 (Admin One), paid by f1 (Finance One).

-- 1. Every paid withdrawal has its own receipt number.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; e2 uuid := '00000000-0000-0000-0000-0000000000e2';
        r1 text; r2 text;
begin
  perform t.as_owner();
  select receipt_number into r1 from public.withdrawal_requests where member_id = e1 and status = 'paid';
  select receipt_number into r2 from public.withdrawal_requests where member_id = e2 and status = 'paid';
  perform t.assert(r1 like 'WDR-%' and r2 like 'WDR-%', 'paid withdrawals carry a WDR- receipt number');
  perform t.assert(r1 <> r2, 'receipt numbers are unique');
  perform t.assert((select count(*) from public.withdrawal_requests where status <> 'paid' and receipt_number is not null) = 0,
                   'only paid withdrawals have a receipt number');
end $$;

-- 2. The member can read their own receipt, with the names of the people who handled it.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; v_id uuid; r record;
begin
  perform t.as_owner();
  select id into v_id from public.withdrawal_requests where member_id = e1 and status = 'paid';
  perform t.as_user(e1);
  select * into r from public.get_withdrawal_receipt(v_id);
  perform t.assert(r.id = v_id, 'member reads own receipt');
  perform t.assert(r.member_name = 'Withdraw One', 'member name on receipt');
  perform t.assert(r.reviewed_by_name = 'Finance And Admin', 'reviewer name on receipt');
  perform t.assert(r.approved_by_name = 'Admin One', 'approver name on receipt');
  perform t.assert(r.paid_by_name = 'Finance One', 'payer name on receipt');
  perform t.assert(r.amount = 60 and r.net_amount = 60 and r.fee_amount = 0, 'amounts on receipt');
  perform t.assert(r.payout_reference = 'ECO-12345', 'payout reference on receipt');
  perform t.as_owner();
end $$;

-- 3. Another member cannot read it; staff can; visitors cannot.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; e2 uuid := '00000000-0000-0000-0000-0000000000e2';
        f1 uuid := '00000000-0000-0000-0000-0000000000f1'; v_id uuid;
begin
  perform t.as_owner();
  select id into v_id from public.withdrawal_requests where member_id = e1 and status = 'paid';
  perform t.as_user(e2);
  perform t.expect_error(format('select * from public.get_withdrawal_receipt(%L)', v_id), '%Not authorised%');
  perform t.as_user(f1);
  perform t.assert((select count(*) from public.get_withdrawal_receipt(v_id)) = 1, 'staff can read any receipt');
  perform t.as_user(null);
  perform t.expect_error(format('select * from public.get_withdrawal_receipt(%L)', v_id), '%permission denied%');
  perform t.as_owner();
end $$;

-- 4. A request that is not paid has no receipt.
do $$
declare e1 uuid := '00000000-0000-0000-0000-0000000000e1'; v_id uuid;
begin
  perform t.as_owner();
  select id into v_id from public.withdrawal_requests where member_id = e1 and status = 'paid';
  -- e1 has only the one paid request; a random id returns nothing.
  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.assert((select count(*) from public.get_withdrawal_receipt(gen_random_uuid())) = 0, 'unknown id returns no receipt');
  perform t.as_owner();
end $$;

-- 5. Staff queue shows who did what.
do $$
declare f1 uuid := '00000000-0000-0000-0000-0000000000f1'; q record;
begin
  perform t.as_user(f1);
  select * into q from public.withdrawal_queue where member_number = (select member_number from public.profiles where id = '00000000-0000-0000-0000-0000000000e1');
  perform t.assert(q.reviewer_name = 'Finance And Admin' and q.approver_name = 'Admin One' and q.payer_name = 'Finance One', 'queue shows reviewer, approver and payer');
  perform t.assert(q.receipt_number like 'WDR-%', 'queue shows the receipt number');
  perform t.as_owner();
end $$;

-- 6. The audit log reads as a story: who, what, about whom, which receipt.
do $$
declare a1 uuid := '00000000-0000-0000-0000-0000000000a1'; r record;
begin
  perform t.as_user(a1);
  select * into r from public.audit_feed
   where action = 'withdrawal.paid' and subject_name = 'Withdraw One';
  perform t.assert(r.actor_name = 'Finance One', 'audit: paid by Finance One');
  perform t.assert(r.receipt_number like 'WDR-%', 'audit: receipt number shown');
  perform t.assert((select actor_name from public.audit_feed where action = 'withdrawal.approved' and subject_name = 'Withdraw One') = 'Admin One', 'audit: approved by Admin One');
  perform t.assert((select actor_name from public.audit_feed where action = 'withdrawal.requested' and subject_name = 'Withdraw One') = 'Withdraw One', 'audit: requested by the member');
  perform t.assert((select actor_name from public.audit_feed where action = 'withdrawal.reviewed' and subject_name = 'Withdraw One') = 'Finance And Admin', 'audit: reviewed by Finance And Admin');
  perform t.as_owner();
end $$;
