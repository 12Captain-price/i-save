-- 012: withdrawal receipts and a clear record of who did what.
--
-- Adds, on top of 011:
--   * A receipt number (WDR-000001, ...) given to a withdrawal at the moment it is paid out.
--   * get_withdrawal_receipt(): everything on the receipt, including the NAMES of the staff who
--     reviewed, approved and paid. The member who withdrew can read their own; staff can read any.
--   * withdrawal_queue now also shows those names, the member id and the receipt number.
--   * The audit feed now shows the member and the receipt number for withdrawal rows, so the audit
--     log reads "<staff name> paid out a withdrawal about <member>, receipt WDR-000001".
--
-- Nothing is deleted or rewritten. A withdrawal paid out before this migration (there should be
-- none, withdrawals were switched off) would simply have no receipt number.

create sequence if not exists public.withdrawal_receipt_seq start 1;

alter table public.withdrawal_requests
  add column if not exists receipt_number text unique;

-- ---------------------------------------------------------------------
-- 1. Payout now also issues the receipt number (same rules as 011, one addition)
-- ---------------------------------------------------------------------
create or replace function public.record_withdrawal_payout(p_id uuid, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_w   public.withdrawal_requests%rowtype;
  v_led uuid;
  v_rct text;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_reference is null or length(trim(p_reference)) < 3 then
    raise exception 'Enter the payout reference (EcoCash transaction ID or cash receipt number)';
  end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_w.status = 'paid' then return v_w.ledger_id; end if;           -- safe to retry
  if v_w.member_id = auth.uid() then raise exception 'You cannot pay out your own withdrawal'; end if;
  if v_w.status <> 'approved' then raise exception 'Only approved requests can be paid out (status: %)', v_w.status; end if;

  insert into public.ledger_transactions
         (member_id, type, amount, fee_delta, savings_delta, currency, reason, created_by)
  values (v_w.member_id, 'withdrawal', v_w.amount, v_w.fee_amount, -v_w.amount, v_w.currency,
          'Withdrawal paid out. Reference ' || trim(p_reference), auth.uid())
  returning id into v_led;                       -- ledger_guard refuses if savings are now too low

  v_rct := 'WDR-' || lpad(nextval('public.withdrawal_receipt_seq')::text, 6, '0');

  update public.withdrawal_requests
     set status = 'paid', paid_by = auth.uid(), paid_at = now(),
         payout_reference = trim(p_reference), ledger_id = v_led, receipt_number = v_rct
   where id = p_id;

  -- The member has taken their savings out: close the plan so nothing more is collected.
  update public.due_items set status = 'cancelled'
   where member_id = v_w.member_id and status in ('scheduled', 'due')
     and enrollment_id in (select id from public.plan_enrollments
                            where member_id = v_w.member_id and status in ('active', 'paused'));
  update public.plan_enrollments set status = 'closed', next_due_date = null
   where member_id = v_w.member_id and status in ('active', 'paused');

  perform public.write_audit('withdrawal.paid', 'withdrawal_request', p_id::text,
            jsonb_build_object('ledger_id', v_led, 'amount', v_w.amount, 'fee', v_w.fee_amount,
                               'net', v_w.net_amount, 'reference', trim(p_reference),
                               'receipt_number', v_rct,
                               'reviewed_by', v_w.reviewed_by, 'approved_by', v_w.approved_by));
  perform public.queue_notification(v_w.member_id, 'withdrawal_paid', 'Withdrawal paid',
            'Your withdrawal of ' || v_w.net_amount::text || ' ' || v_w.currency || ' was paid. Receipt '
            || v_rct || '. Reference: ' || trim(p_reference));
  return v_led;
end $$;
revoke all on function public.record_withdrawal_payout(uuid, text) from public, anon;
grant execute on function public.record_withdrawal_payout(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. The receipt itself. Names come from profiles, which a member cannot read for staff, so this
--    is a security definer function that first checks the caller is the member or staff.
-- ---------------------------------------------------------------------
create or replace function public.get_withdrawal_receipt(p_id uuid)
returns table (
  id               uuid,
  receipt_number   text,
  member_id        uuid,
  member_number    text,
  member_name      text,
  amount           numeric,
  fee_amount       numeric,
  net_amount       numeric,
  currency         text,
  early_exit       boolean,
  payout_method    text,
  payout_number    text,
  payout_name      text,
  payout_reference text,
  requested_at     timestamptz,
  reviewed_by_name text,
  reviewed_at      timestamptz,
  approved_by_name text,
  approved_at      timestamptz,
  paid_by_name     text,
  paid_at          timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_member uuid;
begin
  if auth.uid() is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  select w.member_id into v_member from public.withdrawal_requests w where w.id = p_id;
  if v_member is null then return; end if;
  if v_member <> auth.uid() and not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
  select w.id, w.receipt_number, w.member_id, m.member_number, m.full_name,
         w.amount, w.fee_amount, coalesce(w.net_amount, w.amount), w.currency, w.early_exit,
         w.payout_method, w.payout_number, w.payout_name, w.payout_reference,
         w.created_at,
         coalesce(nullif(rv.full_name, ''), 'Staff member'), w.reviewed_at,
         coalesce(nullif(ap.full_name, ''), 'Staff member'), w.approved_at,
         coalesce(nullif(pd.full_name, ''), 'Staff member'), w.paid_at
    from public.withdrawal_requests w
    join public.profiles m  on m.id  = w.member_id
    left join public.profiles rv on rv.id = w.reviewed_by
    left join public.profiles ap on ap.id = w.approved_by
    left join public.profiles pd on pd.id = w.paid_by
   where w.id = p_id and w.status = 'paid';
end $$;
revoke all on function public.get_withdrawal_receipt(uuid) from public, anon;
grant execute on function public.get_withdrawal_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Staff queue: add names, member id and receipt number (new columns go at the end)
-- ---------------------------------------------------------------------
create or replace view public.withdrawal_queue with (security_invoker = true) as
select w.id, w.status, w.amount, w.fee_amount, w.net_amount, w.currency, w.early_exit,
       w.payout_method, w.payout_number, w.payout_name, w.member_note,
       w.created_at, w.reviewed_by, w.reviewed_at, w.approved_by, w.approved_at,
       w.paid_at, w.payout_reference, w.reject_reason,
       pr.member_number, pr.full_name, pr.phone,
       w.member_id,
       w.receipt_number,
       rv.full_name as reviewer_name,
       ap.full_name as approver_name,
       pd.full_name as payer_name,
       rj.full_name as rejecter_name,
       w.rejected_at
  from public.withdrawal_requests w
  join public.profiles pr on pr.id = w.member_id
  left join public.profiles rv on rv.id = w.reviewed_by
  left join public.profiles ap on ap.id = w.approved_by
  left join public.profiles pd on pd.id = w.paid_by
  left join public.profiles rj on rj.id = w.rejected_by;

-- ---------------------------------------------------------------------
-- 4. Audit feed: same columns as 006, plus withdrawals are matched to their member and receipt
-- ---------------------------------------------------------------------
create or replace view public.audit_feed with (security_invoker = true) as
select a.id,
       a.created_at,
       a.action,
       a.entity,
       a.entity_id,
       a.details,
       a.actor_id,
       case when a.actor_id is null then 'System'
            else coalesce(nullif(ap.full_name, ''), 'Unknown user') end as actor_name,
       ap.member_number                                                   as actor_number,
       sm.id                                                              as subject_member_id,
       sm.full_name                                                       as subject_name,
       sm.member_number                                                   as subject_number,
       coalesce(a.details ->> 'receipt_number', r.receipt_number, wr.receipt_number) as receipt_number
  from public.audit_logs a
  left join public.profiles ap on ap.id = a.actor_id
  left join public.payments pay
         on a.entity = 'payment' and pay.id::text = a.entity_id
  left join public.ledger_transactions lt
         on a.entity = 'ledger_transaction' and lt.id::text = a.entity_id
  left join public.plan_enrollments enr
         on a.entity = 'plan_enrollment' and enr.id::text = a.entity_id
  left join public.withdrawal_requests wr
         on a.entity = 'withdrawal_request' and wr.id::text = a.entity_id
  left join public.receipts r
         on (a.entity = 'payment' and r.payment_id = pay.id)
         or (a.entity = 'ledger_transaction' and r.ledger_id = lt.id)
  left join public.profiles sm
         on sm.id::text = coalesce(case when a.entity = 'profile' then a.entity_id end,
                                   pay.member_id::text,
                                   lt.member_id::text,
                                   enr.member_id::text,
                                   wr.member_id::text);
