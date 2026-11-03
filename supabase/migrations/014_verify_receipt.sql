-- 014: public receipt check. Every printed receipt carries a QR code that opens
-- /verify/<receipt id>. The id is a random UUID, so receipts cannot be found by counting
-- receipt numbers, and the answer holds only what is printed on the receipt, with the
-- member's name cut down to initials. Nothing here can change any data.

create or replace function public.verify_receipt(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  v_initials text;
begin
  select rc.receipt_number, rc.purpose, rc.amount, rc.currency, rc.issued_at,
         pr.full_name,
         exists (select 1 from public.ledger_transactions l
                  where l.reverses_id = rc.ledger_id) as reversed
    into r
    from public.receipts rc
    join public.profiles pr on pr.id = rc.member_id
   where rc.id = p_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select string_agg(upper(left(w, 1)) || '.', ' ')
    into v_initials
    from unnest(regexp_split_to_array(trim(r.full_name), '\s+')) as w
   where w <> '';

  return jsonb_build_object(
    'found', true,
    'receipt_number', r.receipt_number,
    'purpose', r.purpose::text,
    'amount', r.amount,
    'currency', r.currency,
    'issued_at', r.issued_at,
    'reversed', r.reversed,
    'member_initials', coalesce(v_initials, '')
  );
end $$;

revoke all on function public.verify_receipt(uuid) from public;
grant execute on function public.verify_receipt(uuid) to anon, authenticated;
