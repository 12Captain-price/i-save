-- =====================================================================
-- iSave | Migration 004 | Reversing a payment puts back what the payment used up
-- Run AFTER 003_plan_term_fix.sql, once, in the Supabase SQL editor.
--
-- The problem: reverse_ledger_transaction() (migration 001) reversed the ledger row
-- and marked the payment "reversed", but left the thing the payment settled as it
-- was. Reverse a savings contribution and savings dropped, yet the due contribution
-- stayed "paid" and could never be collected again. Reverse a subscription payment
-- and its invoice stayed "paid".
--
-- The fix: when a payment is reversed,
--   * its due contribution goes back to "scheduled" (or "due" if the date has passed),
--     as long as the member's plan is still active or paused, and the plan's next
--     due date points at the earliest contribution still owed;
--   * its subscription invoice goes back to "open" (or "overdue" if past due).
-- Everything else in the function is exactly as in migration 001. The audit row now
-- also records what was put back.
--
-- Not changed on purpose: reversing a registration fee does NOT deactivate the
-- member. That is a decision for an admin, not a side effect.
-- =====================================================================

begin;

create or replace function public.reverse_ledger_transaction(p_ledger_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_orig       public.ledger_transactions%rowtype;
  v_id         uuid;
  v_pay        public.payments%rowtype;
  v_due        public.due_items%rowtype;
  v_enr_status public.enrollment_status;
  v_due_back   boolean := false;
  v_inv_back   boolean := false;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'A reason (at least 5 characters) is required';
  end if;

  select * into v_orig from public.ledger_transactions where id = p_ledger_id;
  if not found then raise exception 'Ledger transaction not found'; end if;
  if v_orig.type = 'reversal' then raise exception 'A reversal cannot be reversed'; end if;
  if exists (select 1 from public.ledger_transactions where reverses_id = v_orig.id) then
    raise exception 'This transaction has already been reversed';
  end if;

  insert into public.ledger_transactions
         (member_id, payment_id, type, amount, fee_delta, savings_delta, currency, reverses_id, reason, created_by)
  values (v_orig.member_id, v_orig.payment_id, 'reversal', v_orig.amount,
          -v_orig.fee_delta, -v_orig.savings_delta, v_orig.currency, v_orig.id, p_reason, auth.uid())
  returning id into v_id;

  if v_orig.payment_id is not null then
    update public.payments set status = 'reversed' where id = v_orig.payment_id and status = 'confirmed';

    select * into v_pay from public.payments where id = v_orig.payment_id;

    -- Put the due contribution back so it can be collected again.
    if v_pay.due_item_id is not null then
      select * into v_due from public.due_items where id = v_pay.due_item_id and status = 'paid';
      if found then
        select status into v_enr_status from public.plan_enrollments where id = v_due.enrollment_id;
        if v_enr_status in ('active', 'paused') then
          update public.due_items
             set status = case when v_due.due_date <= (now() at time zone 'Africa/Harare')::date
                               then 'due'::public.due_item_status
                               else 'scheduled'::public.due_item_status end
           where id = v_due.id;
          update public.plan_enrollments
             set next_due_date = (select min(d.due_date) from public.due_items d
                                   where d.enrollment_id = v_due.enrollment_id
                                     and d.status in ('scheduled', 'due'))
           where id = v_due.enrollment_id;
          v_due_back := true;
        end if;
      end if;
    end if;

    -- Put the subscription invoice back to unpaid.
    if v_pay.invoice_id is not null then
      update public.subscription_invoices
         set status = case when due_date < (now() at time zone 'Africa/Harare')::date
                           then 'overdue'::public.invoice_status
                           else 'open'::public.invoice_status end
       where id = v_pay.invoice_id and status = 'paid';
      v_inv_back := found;
    end if;
  end if;

  perform public.write_audit('ledger.reversed', 'ledger_transaction', v_orig.id::text,
            jsonb_build_object('reversal_id', v_id, 'reason', p_reason,
                               'due_item_reinstated', v_due_back,
                               'invoice_reinstated', v_inv_back));
  perform public.queue_notification(v_orig.member_id, 'transaction_reversed', 'Transaction reversed',
            'A transaction on your account (' || v_orig.reference || ') was reversed by our team.');
  return v_id;
end $$;
revoke all on function public.reverse_ledger_transaction(uuid, text) from public, anon;
grant execute on function public.reverse_ledger_transaction(uuid, text) to authenticated, service_role;

commit;
