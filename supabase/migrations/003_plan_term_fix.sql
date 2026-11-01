-- =====================================================================
-- iSave | Migration 003 | A plan of N weeks collects N weekly contributions
-- Run AFTER 002_office_payments.sql, once, in the Supabase SQL editor.
--
-- The problem: the first contribution is due one week after joining, and the
-- next one was only scheduled when it fell BEFORE the plan's end date. The
-- last weekly contribution falls ON the end date, so it was never scheduled.
-- A 2-week plan collected 1 contribution and a 52-week plan collected 51.
--
-- The fix: schedule the next contribution when it falls on or before the end
-- date. This restates confirm_payment() exactly as in migration 001, with that
-- one comparison changed from "<" to "<=". Nothing else in the function moves.
--
-- Members already enrolled keep the contributions already scheduled. Only
-- contributions confirmed after this runs use the new rule. See the repair
-- note at the bottom for an enrolment that already stopped one short.
-- =====================================================================

begin;

-- ---- 13c (revised). THE ONLY WAY A PAYMENT REACHES THE LEDGER -----------
-- Callable by finance/admin staff (manual verification) or the service role
-- (provider adapter / webhook Worker). Idempotent: confirming twice is a no-op.
create or replace function public.confirm_payment(
  p_payment_id         uuid,
  p_provider_reference text    default null,
  p_confirmed_amount   numeric default null   -- amount the provider reports; must match
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pay    public.payments%rowtype;
  v_ledger uuid;
  v_type   public.ledger_type;
  v_due    public.due_items%rowtype;
  v_enr    public.plan_enrollments%rowtype;
  v_ver    public.savings_plan_versions%rowtype;
begin
  -- service_role has auth.uid() = null (anon/public cannot execute this function at all)
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;

  if auth.uid() is not null and auth.uid() = v_pay.member_id then
    raise exception 'Staff cannot confirm their own payments' using errcode = '42501';
  end if;

  -- Idempotent: already confirmed -> return the existing ledger row.
  if v_pay.status = 'confirmed' then
    select id into v_ledger from public.ledger_transactions
     where payment_id = v_pay.id
       and type in ('registration_fee', 'monthly_subscription', 'savings_contribution');
    return v_ledger;
  end if;

  if v_pay.status not in ('initiated', 'pending') then
    raise exception 'Payment % is % and cannot be confirmed', v_pay.reference, v_pay.status;
  end if;

  if p_confirmed_amount is not null and p_confirmed_amount <> v_pay.amount then
    raise exception 'Amount mismatch on %: expected %, provider reported %',
      v_pay.reference, v_pay.amount, p_confirmed_amount
      using errcode = 'P0001', hint = 'Do not confirm. Flag for finance review.';
  end if;

  update public.payments
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = auth.uid(),
         provider_reference = coalesce(p_provider_reference, provider_reference)
   where id = v_pay.id;

  v_type := case v_pay.purpose
              when 'registration_fee'     then 'registration_fee'::public.ledger_type
              when 'monthly_subscription' then 'monthly_subscription'::public.ledger_type
              else                             'savings_contribution'::public.ledger_type
            end;

  insert into public.ledger_transactions
         (member_id, payment_id, type, amount, fee_delta, savings_delta, currency, created_by)
  values (v_pay.member_id, v_pay.id, v_type, v_pay.amount,
          case when v_pay.purpose = 'savings_contribution' then 0 else v_pay.amount end,
          case when v_pay.purpose = 'savings_contribution' then v_pay.amount else 0 end,
          v_pay.currency, auth.uid())
  returning id into v_ledger;

  -- Side effects by purpose
  if v_pay.purpose = 'registration_fee' then
    update public.profiles set status = 'active'
     where id = v_pay.member_id and status = 'pending';

  elsif v_pay.purpose = 'monthly_subscription' then
    if v_pay.invoice_id is not null then
      update public.subscription_invoices set status = 'paid' where id = v_pay.invoice_id;
    end if;

  elsif v_pay.purpose = 'savings_contribution' and v_pay.due_item_id is not null then
    update public.due_items set status = 'paid' where id = v_pay.due_item_id
    returning * into v_due;
    select * into v_enr from public.plan_enrollments where id = v_due.enrollment_id;
    select * into v_ver from public.savings_plan_versions where id = v_enr.plan_version_id;
    -- schedule the next weekly item unless the plan term has ended
    if v_enr.status = 'active' and v_ver.frequency = 'weekly'
       and (v_ver.duration_weeks is null
            or v_due.due_date + 7 <= v_enr.effective_date + (v_ver.duration_weeks * 7)) then
      insert into public.due_items (enrollment_id, member_id, due_date, amount, currency)
      values (v_enr.id, v_enr.member_id, v_due.due_date + 7, v_ver.contribution_amount, v_ver.currency)
      on conflict (enrollment_id, due_date) do nothing;
      update public.plan_enrollments set next_due_date = v_due.due_date + 7 where id = v_enr.id;
    end if;
  end if;

  perform public.write_audit('payment.confirmed', 'payment', v_pay.id::text,
            jsonb_build_object('reference', v_pay.reference, 'ledger_id', v_ledger,
                               'provider_reference', p_provider_reference));
  perform public.queue_notification(v_pay.member_id, 'payment_confirmed', 'Payment confirmed',
            'Your payment ' || v_pay.reference || ' of ' || v_pay.currency || ' ' || v_pay.amount || ' has been confirmed.');
  return v_ledger;
end $$;
revoke all on function public.confirm_payment(uuid, text, numeric) from public, anon;
grant execute on function public.confirm_payment(uuid, text, numeric) to authenticated, service_role;

commit;

-- =====================================================================
-- REPAIR NOTE (only if an enrolment already stopped one contribution short)
--
-- An enrolment whose weekly schedule ended early under the old rule is missing
-- its final due item. Check one member by number before changing anything:
--
--   select d.due_date, d.status, e.effective_date, v.duration_weeks
--     from public.plan_enrollments e
--     join public.savings_plan_versions v on v.id = e.plan_version_id
--     join public.profiles p on p.id = e.member_id
--     left join public.due_items d on d.enrollment_id = e.id
--    where p.member_number = 'ISV-000001'
--    order by d.due_date;
--
-- If the last paid due date plus 7 days equals effective_date + duration_weeks*7
-- and no item exists for it, add it with the plan's own amount:
--
--   insert into public.due_items (enrollment_id, member_id, due_date, amount, currency)
--   select e.id, e.member_id, <that date>, v.contribution_amount, v.currency
--     from public.plan_enrollments e
--     join public.savings_plan_versions v on v.id = e.plan_version_id
--     join public.profiles p on p.id = e.member_id
--    where p.member_number = 'ISV-000001' and e.status = 'active'
--   on conflict (enrollment_id, due_date) do nothing;
--
--   update public.plan_enrollments set next_due_date = <that date>
--    where id = (select e.id from public.plan_enrollments e
--                  join public.profiles p on p.id = e.member_id
--                 where p.member_number = 'ISV-000001' and e.status = 'active');
-- =====================================================================
