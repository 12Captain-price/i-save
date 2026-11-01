-- =====================================================================
-- iSave | Migration 002 | Office payments, receipts, ID handling,
--                          currency guard, daily staff report
-- Run AFTER 001_isave_schema.sql, once, in the Supabase SQL editor.
--
-- What this adds:
--   * Profile fields: registration channel, ID sighting, consents, category
--   * One person = one account: unique phone number and unique national ID
--   * National ID kept in a locked table; every staff view is audit-logged
--   * Accounts cannot become active until staff have sighted the ID
--   * Receipts: one per confirmed payment, numbered, append-only
--   * record_office_payment(): staff take cash or bank money and confirm
--     it in one step, through the same confirm_payment() as every other path
--   * enabled_currencies setting enforced on every new payment (USD only)
--   * Daily report per staff member, plus an admin sign-off
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PROFILE FIELDS
-- ---------------------------------------------------------------------
alter table public.profiles
  add column registered_via   text not null default 'online'
                                check (registered_via in ('online', 'staff')),
  add column category_interest text,
  add column age_confirmed_at timestamptz,
  add column terms_accepted_at timestamptz,
  add column id_sighted_by    uuid references auth.users(id),
  add column id_sighted_at    timestamptz;

-- One person = one account. Phone numbers are already E.164 (checked in 001).
create unique index profiles_phone_uq on public.profiles (phone) where phone is not null;

-- ---------------------------------------------------------------------
-- 2. NATIONAL ID (locked table: no client can read it directly)
-- ---------------------------------------------------------------------
create or replace function public.normalize_national_id(p_id text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_id, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create table public.member_identity (
  member_id   uuid primary key references public.profiles(id) on delete restrict,
  national_id text not null unique check (length(national_id) between 6 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger member_identity_touch before update on public.member_identity
  for each row execute function public.touch_updated_at();

-- RLS on with NO policies = nobody but the table owner / service role can touch it.
alter table public.member_identity enable row level security;
revoke all on public.member_identity from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. SETTINGS (proposed defaults, owner to confirm; approved = false)
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public, approved) values
  ('enabled_currencies', '["USD"]', 'Currencies accepted for payments. USD only until ZiG is approved', true, false),
  ('require_id_sighted_before_activation', 'true',
     'Staff must sight the national ID before an account can become active', false, false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 4. CURRENCY GUARD: every new payment must use an enabled currency
-- ---------------------------------------------------------------------
create or replace function public.payments_currency_guard()
returns trigger language plpgsql as $$
declare v_enabled jsonb;
begin
  select value into v_enabled from public.system_settings where key = 'enabled_currencies';
  if v_enabled is not null and not (v_enabled @> to_jsonb(new.currency)) then
    raise exception 'Payments in % are not enabled', new.currency using errcode = '22023';
  end if;
  return new;
end $$;
create trigger payments_currency_guard_trg before insert on public.payments
  for each row execute function public.payments_currency_guard();

-- ---------------------------------------------------------------------
-- 5. PROFILE GUARDS
-- ---------------------------------------------------------------------
-- Members may still edit their own contact details, but never the fields
-- that staff or the system own.
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  -- auth.uid() is null for the service role / SQL editor: allowed.
  if auth.uid() is not null and not public.is_staff() then
    if new.id is distinct from old.id
       or new.status is distinct from old.status
       or new.member_number is distinct from old.member_number
       or new.email is distinct from old.email
       or new.registered_via is distinct from old.registered_via
       or new.id_sighted_by is distinct from old.id_sighted_by
       or new.id_sighted_at is distinct from old.id_sighted_at
       or new.age_confirmed_at is distinct from old.age_confirmed_at
       or new.terms_accepted_at is distinct from old.terms_accepted_at then
      raise exception 'You cannot change status, member number, email or verification fields'
        using errcode = '42501';
    end if;
  end if;
  if new.whatsapp_opt_in and not old.whatsapp_opt_in then
    new.whatsapp_opt_in_at := now();
  end if;
  return new;
end $$;

-- An account cannot go pending -> active until staff have sighted the ID.
-- This guards every path (online payment, office payment, manual update).
create or replace function public.profiles_activation_guard()
returns trigger language plpgsql as $$
declare v_required jsonb;
begin
  if old.status = 'pending' and new.status = 'active' then
    select value into v_required from public.system_settings
     where key = 'require_id_sighted_before_activation';
    if coalesce(v_required, 'true'::jsonb) = 'true'::jsonb and new.id_sighted_at is null then
      raise exception 'The member''s national ID must be sighted by staff before the account can be activated'
        using errcode = '23514', hint = 'Use mark_id_sighted() first, then confirm the payment again.';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_activation_guard_trg before update on public.profiles
  for each row execute function public.profiles_activation_guard();

-- ---------------------------------------------------------------------
-- 6. SIGN-UP TRIGGER (replaces the 001 version)
--    user metadata (set by the member, so treated as a claim):
--      full_name, phone, category_interest, national_id,
--      age_confirmed = 'true', terms_accepted = 'true'
--    app metadata (only the service role can set it; members cannot forge it):
--      registered_via = 'staff'
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nid text := public.normalize_national_id(new.raw_user_meta_data->>'national_id');
begin
  insert into public.profiles
         (id, email, full_name, phone, registered_via, category_interest,
          age_confirmed_at, terms_accepted_at)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'phone', ''),
          case when new.raw_app_meta_data->>'registered_via' = 'staff' then 'staff' else 'online' end,
          nullif(trim(coalesce(new.raw_user_meta_data->>'category_interest', '')), ''),
          case when new.raw_user_meta_data->>'age_confirmed'  = 'true' then now() end,
          case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() end);

  insert into public.user_roles (user_id, role) values (new.id, 'member');

  if v_nid <> '' then
    insert into public.member_identity (member_id, national_id) values (new.id, v_nid);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 7. ID FUNCTIONS (staff only; the number itself is never written to audit)
-- ---------------------------------------------------------------------
create or replace function public.mark_id_sighted(p_member_id uuid, p_national_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := auth.uid();
  v_nid   text := public.normalize_national_id(p_national_id);
begin
  if v_staff is null or not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if v_staff = p_member_id then
    raise exception 'Staff cannot verify their own ID' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_member_id) then
    raise exception 'Member not found';
  end if;

  -- The number read from the physical document wins over what was typed online.
  if v_nid <> '' then
    if length(v_nid) < 6 or length(v_nid) > 20 then
      raise exception 'That does not look like a valid ID number';
    end if;
    if exists (select 1 from public.member_identity
                where national_id = v_nid and member_id <> p_member_id) then
      raise exception 'Another member is already registered with this ID number'
        using errcode = '23505';
    end if;
    insert into public.member_identity (member_id, national_id) values (p_member_id, v_nid)
    on conflict (member_id) do update set national_id = excluded.national_id;
  elsif not exists (select 1 from public.member_identity where member_id = p_member_id) then
    raise exception 'Enter the ID number as it appears on the document';
  end if;

  update public.profiles
     set id_sighted_by = v_staff, id_sighted_at = now()
   where id = p_member_id;

  perform public.write_audit('id.sighted', 'profile', p_member_id::text, '{}'::jsonb);
end $$;
revoke all on function public.mark_id_sighted(uuid, text) from public, anon;
grant execute on function public.mark_id_sighted(uuid, text) to authenticated, service_role;

-- Staff can read an ID number, but every look is recorded. Members can read their own.
create or replace function public.get_member_national_id(p_member_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_nid text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if auth.uid() <> p_member_id then
    if not public.is_staff() then
      raise exception 'Not authorised' using errcode = '42501';
    end if;
    perform public.write_audit('id.viewed', 'profile', p_member_id::text, '{}'::jsonb);
  end if;
  select national_id into v_nid from public.member_identity where member_id = p_member_id;
  return v_nid;
end $$;
revoke all on function public.get_member_national_id(uuid) from public, anon;
grant execute on function public.get_member_national_id(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. PAYMENT COLUMNS + RECEIPTS
-- ---------------------------------------------------------------------
alter table public.payments
  add column office_receipt_no text,                 -- number on the paper receipt book
  add column recorded_by       uuid references auth.users(id);
create unique index payments_office_receipt_uq
  on public.payments (office_receipt_no) where office_receipt_no is not null;

create sequence public.receipt_seq start 1;

create table public.receipts (
  id                uuid primary key default gen_random_uuid(),
  receipt_number    text not null unique
                      default ('RCT-' || lpad(nextval('public.receipt_seq')::text, 8, '0')),
  ledger_id         uuid not null unique references public.ledger_transactions(id),
  payment_id        uuid not null unique references public.payments(id),
  member_id         uuid not null references public.profiles(id) on delete restrict,
  purpose           public.payment_purpose not null,
  amount            numeric(14,2) not null check (amount > 0),
  currency          text not null check (currency ~ '^[A-Z]{3}$'),
  provider          text not null,
  office_receipt_no text,
  issued_by         uuid references auth.users(id),
  issued_at         timestamptz not null default now()
);
create index receipts_member_idx on public.receipts (member_id, issued_at desc);

create trigger receipts_no_change before update or delete on public.receipts
  for each row execute function public.block_mutation();
create trigger receipts_no_truncate before truncate on public.receipts
  for each statement execute function public.block_mutation();

-- Every ledger row that records a payment gets exactly one receipt.
create or replace function public.issue_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pay public.payments%rowtype;
begin
  select * into v_pay from public.payments where id = new.payment_id;
  insert into public.receipts
         (ledger_id, payment_id, member_id, purpose, amount, currency,
          provider, office_receipt_no, issued_by)
  values (new.id, new.payment_id, new.member_id, v_pay.purpose, new.amount, new.currency,
          v_pay.provider, v_pay.office_receipt_no, new.created_by);
  return new;
end $$;
create trigger ledger_issue_receipt after insert on public.ledger_transactions
  for each row
  when (new.type in ('registration_fee', 'monthly_subscription', 'savings_contribution'))
  execute function public.issue_receipt();

-- Readable receipt for the screen / print page. A receipt for a reversed payment stays
-- on record and is shown as reversed.
create view public.member_receipts with (security_invoker = true) as
select r.id, r.receipt_number, r.purpose, r.amount, r.currency, r.provider,
       r.office_receipt_no, r.issued_at, r.member_id,
       pr.member_number, pr.full_name,
       exists (select 1 from public.ledger_transactions l where l.reverses_id = r.ledger_id) as reversed
  from public.receipts r
  join public.profiles pr on pr.id = r.member_id;

alter table public.receipts enable row level security;
create policy receipts_select on public.receipts for select
  using (member_id = auth.uid() or public.is_staff());
revoke insert, update, delete, truncate on public.receipts from anon, authenticated;
revoke all on public.member_receipts from anon;

-- ---------------------------------------------------------------------
-- 9. record_office_payment(): cash or bank money taken at the office
--    Creates the payment, then confirms it through confirm_payment(), so
--    the ledger, receipt, audit and notification all come from one path.
-- ---------------------------------------------------------------------
create or replace function public.record_office_payment(
  p_member_id       uuid,
  p_purpose         public.payment_purpose,
  p_method          text,                       -- 'cash' | 'bank_transfer'
  p_receipt_no      text,                       -- number from the paper receipt book
  p_idempotency_key text,
  p_due_item_id     uuid    default null,       -- required for savings contributions
  p_invoice_id      uuid    default null,       -- optional for subscriptions
  p_amount          numeric default null,       -- only for ranged savings plans
  p_evidence_note   text    default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_staff    uuid := auth.uid();
  v_receipt  text := nullif(trim(coalesce(p_receipt_no, '')), '');
  v_member   public.profiles%rowtype;
  v_existing public.payments%rowtype;
  v_setting  jsonb;
  v_amount   numeric(14,2);
  v_currency text := 'USD';
  v_due      public.due_items%rowtype;
  v_enr      public.plan_enrollments%rowtype;
  v_ver      public.savings_plan_versions%rowtype;
  v_inv      public.subscription_invoices%rowtype;
  v_pay_id   uuid;
  v_ledger   uuid;
  v_rcpt     public.receipts%rowtype;
begin
  if v_staff is null or not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if v_staff = p_member_id then
    raise exception 'Staff cannot record payments for themselves' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;
  if p_method not in ('cash', 'bank_transfer') then
    raise exception 'Payment method must be cash or bank_transfer';
  end if;
  if v_receipt is null or length(v_receipt) < 3 or length(v_receipt) > 40 then
    raise exception 'Enter the receipt number from the receipt book (3 to 40 characters)';
  end if;

  -- Safe retry: same key for the same member returns the receipt already issued.
  select * into v_existing from public.payments
   where member_id = p_member_id and idempotency_key = p_idempotency_key;
  if found then
    select * into v_rcpt from public.receipts where payment_id = v_existing.id;
    return jsonb_build_object('payment_id', v_existing.id, 'ledger_id', v_rcpt.ledger_id,
                              'receipt_id', v_rcpt.id, 'receipt_number', v_rcpt.receipt_number,
                              'already_recorded', true);
  end if;

  if exists (select 1 from public.payments where office_receipt_no = v_receipt) then
    raise exception 'Receipt number % has already been used', v_receipt using errcode = '23505';
  end if;

  select * into v_member from public.profiles where id = p_member_id;
  if not found then raise exception 'Member not found'; end if;
  if v_member.status in ('suspended', 'closed') then
    raise exception 'This member''s account cannot take payments';
  end if;

  if p_purpose = 'registration_fee' then
    select value into v_setting from public.system_settings where key = 'registration_fee' and approved;
    if v_setting is null then raise exception 'Registration fee is not configured'; end if;
    v_amount   := (v_setting->>'amount')::numeric;
    v_currency := v_setting->>'currency';
    if exists (select 1 from public.payments
                where member_id = p_member_id and purpose = 'registration_fee'
                  and status in ('initiated', 'pending', 'confirmed')) then
      raise exception 'A registration fee payment already exists for this member';
    end if;
    -- Friendly early check; profiles_activation_guard enforces it for every path.
    select value into v_setting from public.system_settings
     where key = 'require_id_sighted_before_activation';
    if coalesce(v_setting, 'true'::jsonb) = 'true'::jsonb and v_member.id_sighted_at is null then
      raise exception 'Sight the member''s national ID first, then record the registration fee';
    end if;

  elsif p_purpose = 'monthly_subscription' then
    if v_member.status <> 'active' then raise exception 'This member''s account is not active yet'; end if;
    if p_invoice_id is not null then
      select * into v_inv from public.subscription_invoices
       where id = p_invoice_id and member_id = p_member_id and status in ('open', 'overdue');
      if not found then raise exception 'Invoice not found or already paid'; end if;
      v_amount := v_inv.amount; v_currency := v_inv.currency;
    else
      select value into v_setting from public.system_settings where key = 'monthly_subscription' and approved;
      if v_setting is null then raise exception 'Subscription fee is not configured'; end if;
      v_amount   := (v_setting->>'amount')::numeric;
      v_currency := v_setting->>'currency';
    end if;

  else -- savings_contribution
    if v_member.status <> 'active' then raise exception 'This member''s account is not active yet'; end if;
    if p_due_item_id is null then raise exception 'Choose the due contribution being paid'; end if;
    select * into v_due from public.due_items
     where id = p_due_item_id and member_id = p_member_id and status in ('scheduled', 'due');
    if not found then raise exception 'Contribution not found or already paid'; end if;
    if exists (select 1 from public.payments
                where due_item_id = p_due_item_id and status in ('initiated', 'pending')) then
      raise exception 'A payment for this contribution is already awaiting verification';
    end if;
    select * into v_enr from public.plan_enrollments where id = v_due.enrollment_id;
    if v_enr.status <> 'active' then raise exception 'This member''s plan is not active'; end if;
    select * into v_ver from public.savings_plan_versions where id = v_enr.plan_version_id;
    v_currency := v_due.currency;
    if v_due.amount is not null then
      v_amount := v_due.amount;                          -- fixed plan amount, ignore client value
    else
      if p_amount is null then raise exception 'Enter the contribution amount'; end if;
      if p_amount < coalesce(v_ver.min_amount, 0) or p_amount > coalesce(v_ver.max_amount, p_amount) then
        raise exception 'Amount is outside the permitted range for this plan';
      end if;
      v_amount := p_amount;
    end if;
  end if;

  insert into public.payments
         (member_id, purpose, amount, currency, status, provider, idempotency_key,
          due_item_id, invoice_id, evidence_note, office_receipt_no, recorded_by)
  values (p_member_id, p_purpose, v_amount, v_currency, 'pending', 'office_' || p_method,
          p_idempotency_key, p_due_item_id, p_invoice_id, p_evidence_note, v_receipt, v_staff)
  returning id into v_pay_id;

  -- The one and only way money reaches the ledger.
  v_ledger := public.confirm_payment(v_pay_id, null, null);

  select * into v_rcpt from public.receipts where payment_id = v_pay_id;

  perform public.write_audit('office_payment.recorded', 'payment', v_pay_id::text,
            jsonb_build_object('purpose', p_purpose, 'method', p_method, 'amount', v_amount,
                               'currency', v_currency, 'receipt_no', v_receipt,
                               'receipt_number', v_rcpt.receipt_number));

  return jsonb_build_object('payment_id', v_pay_id, 'ledger_id', v_ledger,
                            'receipt_id', v_rcpt.id, 'receipt_number', v_rcpt.receipt_number,
                            'already_recorded', false);
end $$;
revoke all on function public.record_office_payment(uuid, public.payment_purpose, text, text, text, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.record_office_payment(uuid, public.payment_purpose, text, text, text, uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. DAILY STAFF REPORT + ADMIN SIGN-OFF
--     Days are cut in Zimbabwe time (Africa/Harare, CAT).
-- ---------------------------------------------------------------------
create view public.staff_daily_report with (security_invoker = true) as
select (p.confirmed_at at time zone 'Africa/Harare')::date                         as report_date,
       p.confirmed_by                                                                as staff_id,
       coalesce(s.full_name, 'System')                                               as staff_name,
       p.currency,
       count(*) filter (where p.status = 'confirmed')                                as payments_count,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)::numeric(14,2) as total_amount,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.purpose = 'registration_fee'), 0)::numeric(14,2)     as registration_total,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.purpose = 'monthly_subscription'), 0)::numeric(14,2) as subscription_total,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.purpose = 'savings_contribution'), 0)::numeric(14,2) as savings_total,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.provider = 'office_cash'), 0)::numeric(14,2)          as cash_total,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.provider = 'office_bank_transfer'), 0)::numeric(14,2) as bank_total,
       coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.provider not like 'office\_%'), 0)::numeric(14,2)     as other_total,
       count(*) filter (where p.status = 'reversed')                                 as reversed_count,
       coalesce(sum(p.amount) filter (where p.status = 'reversed'), 0)::numeric(14,2) as reversed_total
  from public.payments p
  left join public.profiles s on s.id = p.confirmed_by
 where p.confirmed_at is not null
   and public.is_staff()          -- members must never see the staff report
 group by 1, 2, 3, 4;

create table public.daily_signoffs (
  id          uuid primary key default gen_random_uuid(),
  report_date date not null,
  staff_id    uuid not null references auth.users(id),
  signed_by   uuid not null references auth.users(id),
  signed_at   timestamptz not null default now(),
  totals      jsonb not null,                  -- snapshot of the report rows signed
  note        text,
  unique (report_date, staff_id)
);
create trigger daily_signoffs_no_change before update or delete on public.daily_signoffs
  for each row execute function public.block_mutation();
alter table public.daily_signoffs enable row level security;
create policy daily_signoffs_select on public.daily_signoffs for select using (public.is_staff());
revoke insert, update, delete, truncate on public.daily_signoffs from anon, authenticated;
revoke all on public.staff_daily_report from anon;

create or replace function public.sign_off_daily_report(p_date date, p_staff_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_totals jsonb;
  v_id     uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can sign off a daily report' using errcode = '42501';
  end if;
  if auth.uid() = p_staff_id then
    raise exception 'You cannot sign off your own day. Ask another admin.' using errcode = '42501';
  end if;

  select jsonb_agg(to_jsonb(r)) into v_totals
    from public.staff_daily_report r
   where r.report_date = p_date and r.staff_id = p_staff_id;
  if v_totals is null then
    raise exception 'There is nothing to sign off for that staff member on that day';
  end if;

  insert into public.daily_signoffs (report_date, staff_id, signed_by, totals, note)
  values (p_date, p_staff_id, auth.uid(), v_totals, p_note)
  returning id into v_id;

  perform public.write_audit('daily_report.signed_off', 'daily_signoff', v_id::text,
            jsonb_build_object('report_date', p_date, 'staff_id', p_staff_id));
  return v_id;
exception when unique_violation then
  raise exception 'That day has already been signed off for this staff member';
end $$;
revoke all on function public.sign_off_daily_report(date, uuid, text) from public, anon;
grant execute on function public.sign_off_daily_report(date, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. BACKFILL: receipts for any payments already on the ledger
-- ---------------------------------------------------------------------
insert into public.receipts (ledger_id, payment_id, member_id, purpose, amount, currency, provider, office_receipt_no, issued_by, issued_at)
select l.id, l.payment_id, l.member_id, p.purpose, l.amount, l.currency, p.provider, p.office_receipt_no, l.created_by, l.created_at
  from public.ledger_transactions l
  join public.payments p on p.id = l.payment_id
 where l.type in ('registration_fee', 'monthly_subscription', 'savings_contribution')
on conflict do nothing;

commit;
