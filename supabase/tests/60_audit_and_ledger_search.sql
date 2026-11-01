-- Tests for migration 005: audit feed and ledger search.
-- Runs after 50_reversal_schedule.sql, which leaves several payments and reversals behind.

-- 1. Admin sees the audit feed with names; finance and members do not.
do $$
begin
  perform t.as_owner();
  perform t.assert((select count(*) from public.audit_logs) > 0, 'there are audit rows to look at');

  perform t.as_user('00000000-0000-0000-0000-0000000000a1');
  perform t.assert((select count(*) from public.audit_feed) = (select count(*) from public.audit_logs), 'admin sees every audit row');
  perform t.assert(exists (select 1 from public.audit_feed where action = 'ledger.reversed' and actor_name = 'Finance One'), 'a reversal shows WHO did it by name');
  perform t.assert(exists (select 1 from public.audit_feed where action = 'ledger.reversed' and subject_name = 'Member Four'), 'a reversal shows who it was about');
  perform t.assert(exists (select 1 from public.audit_feed where action = 'office_payment.recorded' and receipt_number like 'RCT-%'), 'a payment shows its receipt number');

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.assert((select count(*) from public.audit_feed) = 0, 'finance-only staff cannot read the audit feed');

  perform t.as_user('00000000-0000-0000-0000-0000000000b4');
  perform t.assert((select count(*) from public.audit_feed) = 0, 'a member cannot read the audit feed');
  perform t.as_owner();
end $$;

-- 2. Staff can search the ledger by member, receipt and date; members only see themselves.
do $$
declare v_rct text;
begin
  perform t.as_owner();
  select receipt_number into v_rct from public.receipts
   where member_id = '00000000-0000-0000-0000-0000000000b4' order by issued_at limit 1;

  perform t.as_user('00000000-0000-0000-0000-0000000000f1');
  perform t.assert((select count(*) from public.ledger_search) = (select count(*) from public.ledger_transactions), 'finance sees every ledger row');
  perform t.assert((select count(*) from public.ledger_search where member_number = (select member_number from public.profiles where id = '00000000-0000-0000-0000-0000000000b4')) > 0, 'search by member number works');
  perform t.assert((select count(*) from public.ledger_search where receipt_number = v_rct) >= 1, 'search by receipt number works');
  perform t.assert((select count(*) from public.ledger_search where created_at >= now() - interval '1 day') = (select count(*) from public.ledger_transactions), 'search by date works');
  perform t.assert(exists (select 1 from public.ledger_search where created_by_name = 'Finance One'), 'rows say who recorded them');

  -- A reversal row carries the original receipt number and points back at the original.
  perform t.assert(exists (select 1 from public.ledger_search where type = 'reversal' and receipt_number is not null and reverses_reference like 'LDG-%'), 'a reversal row links to the original and its receipt');
  -- The original is flagged as reversed.
  perform t.assert(exists (select 1 from public.ledger_search where reversed and type <> 'reversal'), 'reversed originals are flagged');

  perform t.as_user('00000000-0000-0000-0000-0000000000b4');
  perform t.assert((select count(*) from public.ledger_search where member_id <> '00000000-0000-0000-0000-0000000000b4') = 0, 'a member sees none of anyone else''s ledger rows');
  perform t.as_owner();
end $$;

-- 3. The views cannot be used to change anything.
do $$
begin
  perform t.as_user('00000000-0000-0000-0000-0000000000a1');
  perform t.expect_error('delete from public.audit_feed', '%');
  perform t.expect_error('update public.ledger_search set reason = ''x''', '%');
  perform t.as_owner();
end $$;
