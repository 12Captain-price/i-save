-- 011: withdrawals (member request -> staff review -> different admin approves -> office pays out).
--
-- Ships SWITCHED OFF. system_settings.withdrawals_enabled stays 'false' until the owner has
-- confirmed the policy in writing. Nothing here changes that setting.
--
-- Rules, all driven by settings so the owner can change them without a new migration:
--   * A member withdraws ALL of their confirmed savings (no partial withdrawals).
--   * Normal: the plan has ended (effective_date + duration_weeks * 7 has passed) and the plan
--     is at least withdrawal_min_weeks long.
--   * Early exit: only if withdrawal_early_exit_allowed is true, only after withdrawal_min_weeks
--     have elapsed, and the fee withdrawal_early_exit_fee_percent is shown before confirming.
--   * An overdue subscription (unpaid more than 7 days after its due date) blocks a request.
--   * Two different people: the reviewer and the approver cannot be the same user, and nobody
--     can review, approve or pay out their own withdrawal.
--   * Money moves only when the office records the payout. That writes ONE ledger row of type
--     'withdrawal' (savings_delta = -gross, fee_delta = fee kept), so balances and charts stay right.
--   * Registration and subscription fees are never refunded: they are not savings.
--   * No interest or bonus anywhere.

-- ---------------------------------------------------------------------
-- 1. Settings (undecided rules are unapproved and conservative)
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public, approved) values
  ('withdrawal_min_weeks',              '12',        'Minimum plan length (weeks) before any withdrawal. Proposed; owner to confirm.', true, false),
  ('withdrawal_early_exit_allowed',     'false',     'Allow leaving before the plan ends. Proposed: off until the owner decides.',     true, false),
  ('withdrawal_early_exit_fee_percent', '"0"',       'Fee (% of savings) for leaving early. Must be disclosed. Owner to decide.',       true, false),
  ('withdrawal_payout_methods',         '["ecocash","cash"]', 'How payouts are made. EcoCash must be in the member''s own name.',         true, false),
  ('withdrawal_payout_days',            '3',         'Business days the office aims to pay after approval.',                             true, false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Table: add the fields the flow needs
-- ---------------------------------------------------------------------
alter table public.withdrawal_requests
  add column enrollment_id    uuid references public.plan_enrollments(id) on delete restrict,
  add column early_exit       boolean not null default false,
  add column fee_amount       numeric(14,2) not null default 0 check (fee_amount >= 0),
  add column net_amount       numeric(14,2),
  add column payout_method    text check (payout_method in ('ecocash', 'cash')),
  add column payout_number    text check (payout_number is null or payout_number ~ '^\+[1-9][0-9]{7,14}$'),
  add column payout_name      text,
  add column member_note      text,
  add column terms_accepted_at timestamptz,
  add column reviewed_by      uuid references auth.users(id),
  add column reviewed_at      timestamptz,
  add column approved_by      uuid references auth.users(id),
  add column approved_at      timestamptz,
  add column rejected_by      uuid references auth.users(id),
  add column rejected_at      timestamptz,
  add column reject_reason    text,
  add column paid_by          uuid references auth.users(id),
  add column paid_at          timestamptz,
  add column payout_reference text,
  add column ledger_id        uuid references public.ledger_transactions(id);

alter table public.withdrawal_requests
  add constraint withdrawal_fee_within_amount check (fee_amount <= amount);

-- One open request per member.
create unique index withdrawal_one_open
  on public.withdrawal_requests (member_id)
  where status in ('requested', 'under_review', 'approved', 'payout_pending');
-- A payout reference is only ever used once.
create unique index withdrawal_payout_ref_unique
  on public.withdrawal_requests (payout_reference) where payout_reference is not null;
create index withdrawal_status_idx on public.withdrawal_requests (status, created_at);

create trigger withdrawal_touch before update on public.withdrawal_requests
  for each row execute function public.touch_updated_at();

-- Rows are only changed through the functions below. Block any other way to move money state.
revoke insert, update, delete, truncate on public.withdrawal_requests from authenticated, anon;

-- A finished request is final.
create or replace function public.withdrawal_final_guard()
returns trigger language plpgsql as $$
begin
  if old.status in ('paid', 'rejected', 'cancelled') and new.status is distinct from old.status then
    raise exception 'A % withdrawal request cannot change status', old.status using errcode = '42501';
  end if;
  return new;
end $$;
create trigger withdrawal_final_trg before update on public.withdrawal_requests
  for each row execute function public.withdrawal_final_guard();

-- ---------------------------------------------------------------------
-- 3. What may this member withdraw? (used by the screen AND by request_withdrawal)
-- ---------------------------------------------------------------------
create or replace function public.withdrawal_quote(p_member uuid default auth.uid())
returns table (
  eligible        boolean,
  reason          text,
  currency        text,
  amount          numeric,
  fee_amount      numeric,
  net_amount      numeric,
  early_exit      boolean,
  enrollment_id   uuid,
  eligible_on     date
) language plpgsql stable security definer set search_path = public as $$
declare
  v_enabled   boolean := coalesce((select value = 'true'::jsonb from public.system_settings where key = 'withdrawals_enabled'), false);
  v_min_weeks int     := coalesce((select (value #>> '{}')::int from public.system_settings where key = 'withdrawal_min_weeks'), 12);
  v_early_ok  boolean := coalesce((select value = 'true'::jsonb from public.system_settings where key = 'withdrawal_early_exit_allowed'), false);
  v_fee_pct   numeric := coalesce((select (value #>> '{}')::numeric from public.system_settings where key = 'withdrawal_early_exit_fee_percent'), 0);
  v_profile   public.profiles%rowtype;
  v_cur       text;
  v_bal       numeric;
  v_enr       public.plan_enrollments%rowtype;
  v_ver       public.savings_plan_versions%rowtype;
  v_end       date;
  v_early     boolean := false;
  v_fee       numeric := 0;
begin
  if auth.uid() is not null and p_member is distinct from auth.uid() and not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_member;
  if not found then
    return query select false, 'Member not found'::text, null::text, 0::numeric, 0::numeric, 0::numeric, false, null::uuid, null::date;
    return;
  end if;

  select l.currency, sum(l.savings_delta) into v_cur, v_bal
    from public.ledger_transactions l
   where l.member_id = p_member
   group by l.currency
  having sum(l.savings_delta) > 0
   order by sum(l.savings_delta) desc
   limit 1;

  if not v_enabled then
    return query select false, 'Withdrawals are not open yet.'::text, v_cur, coalesce(v_bal, 0), 0::numeric, 0::numeric, false, null::uuid, null::date;
    return;
  end if;
  if v_profile.status <> 'active' then
    return query select false, 'Your membership must be active.'::text, v_cur, coalesce(v_bal, 0), 0::numeric, 0::numeric, false, null::uuid, null::date;
    return;
  end if;
  if coalesce(v_bal, 0) <= 0 then
    return query select false, 'You have no confirmed savings to withdraw.'::text, v_cur, 0::numeric, 0::numeric, 0::numeric, false, null::uuid, null::date;
    return;
  end if;
  if exists (select 1 from public.withdrawal_requests w
              where w.member_id = p_member and w.status in ('requested', 'under_review', 'approved', 'payout_pending')) then
    return query select false, 'You already have a withdrawal request in progress.'::text, v_cur, v_bal, 0::numeric, 0::numeric, false, null::uuid, null::date;
    return;
  end if;
  if exists (select 1 from public.subscription_invoices i
              where i.member_id = p_member and i.status in ('open', 'overdue') and i.due_date + 7 < current_date) then
    return query select false, 'You have an overdue subscription. Please clear it first.'::text, v_cur, v_bal, 0::numeric, 0::numeric, false, null::uuid, null::date;
    return;
  end if;

  -- The member's most recent enrolment decides the plan term.
  select * into v_enr from public.plan_enrollments e
   where e.member_id = p_member
   order by (e.status in ('active', 'paused')) desc, e.created_at desc
   limit 1;

  if found then
    select * into v_ver from public.savings_plan_versions where id = v_enr.plan_version_id;
    if v_ver.duration_weeks is not null then
      v_end := v_enr.effective_date + (v_ver.duration_weeks * 7);
    end if;

    if v_ver.duration_weeks is not null and v_ver.duration_weeks < v_min_weeks then
      return query select false, format('Withdrawals need a plan of at least %s weeks.', v_min_weeks)::text,
                          v_cur, v_bal, 0::numeric, 0::numeric, false, v_enr.id, null::date;
      return;
    end if;

    if v_enr.status in ('active', 'paused') and (v_end is null or current_date < v_end) then
      -- Plan still running: early exit rules apply.
      if not v_early_ok then
        return query select false,
                            case when v_end is null then 'Your plan has no end date, so early withdrawal is not available.'
                                 else 'Withdrawals open when your plan ends.' end::text,
                            v_cur, v_bal, 0::numeric, 0::numeric, false, v_enr.id, v_end;
        return;
      end if;
      if current_date < v_enr.effective_date + (v_min_weeks * 7) then
        return query select false, format('Early exit is only possible after %s weeks.', v_min_weeks)::text,
                            v_cur, v_bal, 0::numeric, 0::numeric, true, v_enr.id, v_enr.effective_date + (v_min_weeks * 7);
        return;
      end if;
      v_early := true;
      v_fee := round(v_bal * v_fee_pct / 100, 2);
    end if;
  end if;

  return query select true, null::text, v_cur, v_bal, v_fee, v_bal - v_fee, v_early, v_enr.id, v_end;
end $$;
revoke all on function public.withdrawal_quote(uuid) from public, anon;
grant execute on function public.withdrawal_quote(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Member requests a withdrawal
-- ---------------------------------------------------------------------
create or replace function public.request_withdrawal(
  p_payout_method text,
  p_payout_number text,
  p_payout_name   text,
  p_accept        boolean,
  p_note          text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_q   record;
  v_id  uuid;
  v_methods jsonb := coalesce((select value from public.system_settings where key = 'withdrawal_payout_methods'), '["ecocash","cash"]'::jsonb);
begin
  if auth.uid() is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_accept is not true then
    raise exception 'You must confirm the withdrawal terms and any fee before continuing';
  end if;
  if p_payout_method is null or not (v_methods ? p_payout_method) then
    raise exception 'That payout method is not available';
  end if;
  if p_payout_method = 'ecocash' then
    if p_payout_number is null or p_payout_number !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception 'Enter the EcoCash number in +263 format';
    end if;
    if p_payout_name is null or length(trim(p_payout_name)) < 3 then
      raise exception 'Enter the name the EcoCash number is registered in';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('withdrawal:' || auth.uid()::text));
  select * into v_q from public.withdrawal_quote(auth.uid());
  if v_q.eligible is not true then
    raise exception '%', coalesce(v_q.reason, 'You cannot withdraw right now');
  end if;

  insert into public.withdrawal_requests
         (member_id, enrollment_id, amount, currency, early_exit, fee_amount, net_amount,
          payout_method, payout_number, payout_name, member_note, terms_accepted_at)
  values (auth.uid(), v_q.enrollment_id, v_q.amount, v_q.currency, v_q.early_exit, v_q.fee_amount, v_q.net_amount,
          p_payout_method,
          case when p_payout_method = 'ecocash' then p_payout_number end,
          case when p_payout_method = 'ecocash' then trim(p_payout_name) end,
          nullif(trim(coalesce(p_note, '')), ''), now())
  returning id into v_id;

  perform public.write_audit('withdrawal.requested', 'withdrawal_request', v_id::text,
            jsonb_build_object('amount', v_q.amount, 'fee', v_q.fee_amount, 'early_exit', v_q.early_exit,
                               'payout_method', p_payout_method));
  perform public.queue_notification(auth.uid(), 'withdrawal_requested', 'Withdrawal request received',
            'We received your withdrawal request. Our team will review it and tell you the outcome here.');
  return v_id;
end $$;
revoke all on function public.request_withdrawal(text, text, text, boolean, text) from public, anon;
grant execute on function public.request_withdrawal(text, text, text, boolean, text) to authenticated;

-- Member cancels before anyone has approved it.
create or replace function public.cancel_withdrawal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found or v_w.member_id <> auth.uid() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if v_w.status not in ('requested', 'under_review') then
    raise exception 'This request can no longer be cancelled (status: %)', v_w.status;
  end if;
  update public.withdrawal_requests set status = 'cancelled' where id = p_id;
  perform public.write_audit('withdrawal.cancelled', 'withdrawal_request', p_id::text, '{}'::jsonb);
end $$;
revoke all on function public.cancel_withdrawal(uuid) from public, anon;
grant execute on function public.cancel_withdrawal(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Staff: review -> admin approves (a different person) -> office pays out
-- ---------------------------------------------------------------------
create or replace function public.review_withdrawal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_w.member_id = auth.uid() then raise exception 'You cannot review your own withdrawal'; end if;
  if v_w.status <> 'requested' then raise exception 'Only new requests can be reviewed (status: %)', v_w.status; end if;

  update public.withdrawal_requests
     set status = 'under_review', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  perform public.write_audit('withdrawal.reviewed', 'withdrawal_request', p_id::text, '{}'::jsonb);
end $$;
revoke all on function public.review_withdrawal(uuid) from public, anon;
grant execute on function public.review_withdrawal(uuid) to authenticated;

create or replace function public.approve_withdrawal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Only an administrator can approve' using errcode = '42501'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_w.member_id = auth.uid() then raise exception 'You cannot approve your own withdrawal'; end if;
  if v_w.status <> 'under_review' then raise exception 'Only requests under review can be approved (status: %)', v_w.status; end if;
  if v_w.reviewed_by = auth.uid() then
    raise exception 'A different person must approve: you already reviewed this request';
  end if;

  update public.withdrawal_requests
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where id = p_id;
  perform public.write_audit('withdrawal.approved', 'withdrawal_request', p_id::text,
            jsonb_build_object('reviewed_by', v_w.reviewed_by));
  perform public.queue_notification(v_w.member_id, 'withdrawal_approved', 'Withdrawal approved',
            'Your withdrawal was approved. The office will pay it out and tell you here once it is done.');
end $$;
revoke all on function public.approve_withdrawal(uuid) from public, anon;
grant execute on function public.approve_withdrawal(uuid) to authenticated;

create or replace function public.reject_withdrawal(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Only an administrator can reject' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'A reason (at least 5 characters) is required'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_w.member_id = auth.uid() then raise exception 'You cannot reject your own withdrawal'; end if;
  if v_w.status not in ('requested', 'under_review', 'approved') then
    raise exception 'This request can no longer be rejected (status: %)', v_w.status;
  end if;

  update public.withdrawal_requests
     set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), reject_reason = trim(p_reason)
   where id = p_id;
  perform public.write_audit('withdrawal.rejected', 'withdrawal_request', p_id::text,
            jsonb_build_object('reason', trim(p_reason)));
  perform public.queue_notification(v_w.member_id, 'withdrawal_rejected', 'Withdrawal not approved',
            'Your withdrawal request was not approved. Reason: ' || trim(p_reason) || '. Please contact the office if you have questions.');
end $$;
revoke all on function public.reject_withdrawal(uuid, text) from public, anon;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;

-- The office has paid the member. This is the ONLY place a withdrawal touches the ledger.
create or replace function public.record_withdrawal_payout(p_id uuid, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_w   public.withdrawal_requests%rowtype;
  v_led uuid;
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

  update public.withdrawal_requests
     set status = 'paid', paid_by = auth.uid(), paid_at = now(),
         payout_reference = trim(p_reference), ledger_id = v_led
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
                               'net', v_w.net_amount, 'reference', trim(p_reference)));
  perform public.queue_notification(v_w.member_id, 'withdrawal_paid', 'Withdrawal paid',
            'Your withdrawal of ' || v_w.net_amount::text || ' ' || v_w.currency || ' was paid. Reference: ' || trim(p_reference));
  return v_led;
end $$;
revoke all on function public.record_withdrawal_payout(uuid, text) from public, anon;
grant execute on function public.record_withdrawal_payout(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Staff queue (RLS of the caller applies)
-- ---------------------------------------------------------------------
create view public.withdrawal_queue with (security_invoker = true) as
select w.id, w.status, w.amount, w.fee_amount, w.net_amount, w.currency, w.early_exit,
       w.payout_method, w.payout_number, w.payout_name, w.member_note,
       w.created_at, w.reviewed_by, w.reviewed_at, w.approved_by, w.approved_at,
       w.paid_at, w.payout_reference, w.reject_reason,
       pr.member_number, pr.full_name, pr.phone
  from public.withdrawal_requests w
  join public.profiles pr on pr.id = w.member_id;
revoke all on public.withdrawal_queue from anon;
grant select on public.withdrawal_queue to authenticated;
