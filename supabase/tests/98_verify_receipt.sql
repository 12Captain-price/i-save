-- Tests for migration 014: anyone can check a receipt by its id, and learns only what is printed.

do $$
declare
  v_id uuid; v_rev uuid; v_res jsonb;
begin
  perform t.as_owner();
  select id into v_id from public.receipts order by issued_at limit 1;
  perform t.assert(v_id is not null, 'earlier tests left at least one receipt to check');

  -- A visitor who is not signed in can verify.
  perform t.as_user(null);
  v_res := public.verify_receipt(v_id);
  perform t.assert((v_res ->> 'found')::boolean, 'a real receipt is found');
  perform t.assert(v_res ? 'receipt_number' and v_res ? 'amount' and v_res ? 'reversed', 'the printed facts are returned');
  perform t.assert(not (v_res ? 'full_name') and not (v_res ? 'member_id') and not (v_res ? 'member_number'),
                   'no name, member id or member number is returned');
  perform t.assert((v_res ->> 'member_initials') ~ '^([A-Z]\.)( [A-Z]\.)*$' or (v_res ->> 'member_initials') = '',
                   'the name is cut down to initials');

  -- A made-up id is simply not found.
  v_res := public.verify_receipt('00000000-0000-0000-0000-00000000dead');
  perform t.assert(not (v_res ->> 'found')::boolean, 'an unknown id is not found');

  -- The receipts table itself shows visitors nothing (row-level security).
  perform t.assert((select count(*) from public.receipts) = 0, 'a visitor cannot read the receipts table');

  -- A reversed receipt says so (only checked when an earlier test reversed one).
  perform t.as_owner();
  select rc.id into v_rev from public.receipts rc
   where exists (select 1 from public.ledger_transactions l where l.reverses_id = rc.ledger_id) limit 1;
  if v_rev is not null then
    perform t.as_user(null);
    perform t.assert((public.verify_receipt(v_rev) ->> 'reversed')::boolean, 'a reversed receipt is marked reversed');
  end if;
  perform t.as_owner();
end $$;
