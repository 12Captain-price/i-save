-- =====================================================================
-- iSave | Migration 001 | Full schema, ledger integrity, RLS, functions
-- Target: fresh Supabase project (Postgres 15+). Run once in the SQL editor.
--
-- Design rules baked in (from Requirements Spec v1.2):
--   * Fees are NOT savings. fee_delta and savings_delta are separate columns.
--   * Only confirm_payment() can post a payment to the ledger. It is idempotent.
--   * Ledger and audit log are append-only. Corrections = linked reversals.
--   * Nothing financial is hard-coded: amounts live in settings / approved plans.
--   * Withdrawals are disabled until system_settings.withdrawals_enabled = true.
--   * Members can only read their own rows (RLS). Clients cannot write money tables.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type public.app_role            as enum ('member', 'finance', 'admin', 'super_admin');
create type public.member_status       as enum ('pending', 'active', 'suspended', 'closed');
create type public.plan_status         as enum ('draft', 'active', 'paused', 'retired');
create type public.schedule_frequency  as enum ('daily', 'weekly', 'monthly', 'custom');
create type public.enrollment_status   as enum ('active', 'paused', 'closed');
create type public.due_item_status     as enum ('scheduled', 'due', 'paid', 'missed', 'cancelled');
create type public.invoice_status      as enum ('open', 'paid', 'overdue', 'void');
create type public.payment_status      as enum ('initiated', 'pending', 'confirmed', 'failed', 'rejected', 'refunded', 'reversed');
create type public.payment_purpose     as enum ('registration_fee', 'monthly_subscription', 'savings_contribution');
create type public.ledger_type         as enum ('registration_fee', 'monthly_subscription', 'savings_contribution', 'withdrawal', 'refund', 'reversal', 'approved_adjustment');
create type public.notification_channel as enum ('email', 'whatsapp', 'sms', 'in_app');
create type public.notification_status as enum ('queued', 'sent', 'delivered', 'failed');
create type public.withdrawal_status   as enum ('requested', 'under_review', 'approved', 'rejected', 'payout_pending', 'paid', 'failed', 'cancelled');

-- ---------------------------------------------------------------------
-- 2. SEQUENCES (human-friendly references)
-- ---------------------------------------------------------------------
create sequence public.member_number_seq start 1;
create sequence public.payment_ref_seq   start 1;
create sequence public.ledger_ref_seq    start 1;

-- ---------------------------------------------------------------------
-- 3. GENERIC TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% on % is not allowed: this table is append-only', tg_op, tg_table_name
    using errcode = '42501';
end $$;

-- ---------------------------------------------------------------------
-- 4. PROFILES + ROLES
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete restrict,
  member_number       text not null unique
                        default ('ISV-' || lpad(nextval('public.member_number_seq')::text, 6, '0')),
  full_name           text not null default '',
  email               text,
  phone               text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164, e.g. +263771234567
  status              public.member_status not null default 'pending',
  email_opt_in        boolean not null default true,
  whatsapp_opt_in     boolean not null default false,
  whatsapp_opt_in_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Role helpers (security definer so they bypass RLS on user_roles)
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role in ('finance', 'admin', 'super_admin'))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role in ('admin', 'super_admin'))
$$;

-- Members may edit their own profile, but never status / member_number / email.
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  -- auth.uid() is null for the service role / SQL editor: allowed.
  if auth.uid() is not null and not public.is_staff() then
    if new.id is distinct from old.id
       or new.status is distinct from old.status
       or new.member_number is distinct from old.member_number
       or new.email is distinct from old.email then
      raise exception 'You cannot change status, member number or email' using errcode = '42501';
    end if;
  end if;
  if new.whatsapp_opt_in and not old.whatsapp_opt_in then
    new.whatsapp_opt_in_at := now();
  end if;
  return new;
end $$;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

-- Auto-create profile + member role when someone signs up.
-- Pass full_name and phone (E.164) as signUp options.data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'phone', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'member');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5. SYSTEM SETTINGS (owner-approved configuration, never hard-coded)
-- ---------------------------------------------------------------------
create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,
  approved    boolean not null default false,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);
create trigger system_settings_touch before update on public.system_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 6. SAVINGS PLANS (versioned)
-- ---------------------------------------------------------------------
create table public.savings_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.savings_plan_versions (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references public.savings_plans(id) on delete restrict,
  version             int  not null check (version > 0),
  status              public.plan_status not null default 'draft',
  contribution_amount numeric(14,2) check (contribution_amount > 0),   -- fixed amount, OR
  min_amount          numeric(14,2) check (min_amount > 0),            -- permitted range
  max_amount          numeric(14,2) check (max_amount > 0),
  currency            text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  frequency           public.schedule_frequency not null default 'weekly',
  duration_weeks      int check (duration_weeks > 0),                  -- null = open-ended
  terms_text          text not null default '',
  effective_date      date,
  approved_by         uuid references auth.users(id),
  approved_at         timestamptz,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (plan_id, version),
  constraint range_ordered check (min_amount is null or max_amount is null or min_amount <= max_amount),
  -- An ACTIVE plan must be approved and must carry an owner-specified amount. No invented amounts.
  constraint active_needs_approved_amount check (
    status <> 'active'
    or (approved_at is not null
        and (contribution_amount is not null or (min_amount is not null and max_amount is not null)))
  )
);

create or replace function public.plan_version_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.plan_id is distinct from old.plan_id
       or new.version is distinct from old.version
       or new.contribution_amount is distinct from old.contribution_amount
       or new.min_amount is distinct from old.min_amount
       or new.max_amount is distinct from old.max_amount
       or new.currency is distinct from old.currency
       or new.frequency is distinct from old.frequency
       or new.duration_weeks is distinct from old.duration_weeks
       or new.terms_text is distinct from old.terms_text then
      raise exception 'Only draft plan versions can be edited. Create a new version instead.'
        using errcode = '42501';
    end if;
  end if;
  if new.status = 'active' and new.approved_at is null then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger plan_version_guard_trg before insert or update on public.savings_plan_versions
  for each row execute function public.plan_version_guard();

-- ---------------------------------------------------------------------
-- 7. ENROLMENTS, DUE ITEMS, SUBSCRIPTION INVOICES
-- ---------------------------------------------------------------------
create table public.plan_enrollments (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.profiles(id) on delete restrict,
  plan_version_id uuid not null references public.savings_plan_versions(id) on delete restrict,
  status          public.enrollment_status not null default 'active',
  accepted_terms  jsonb not null,            -- exact terms snapshot shown to the member
  accepted_at     timestamptz not null default now(),
  effective_date  date not null,
  next_due_date   date,
  created_at      timestamptz not null default now()
);
create unique index plan_enrollments_one_open
  on public.plan_enrollments (member_id) where status in ('active', 'paused');

create table public.due_items (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.plan_enrollments(id) on delete restrict,
  member_id     uuid not null references public.profiles(id) on delete restrict,
  due_date      date not null,
  amount        numeric(14,2) check (amount > 0),   -- null when the plan has an amount range
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  status        public.due_item_status not null default 'scheduled',
  created_at    timestamptz not null default now(),
  unique (enrollment_id, due_date)
);
create index due_items_member_idx on public.due_items (member_id, due_date);

create table public.subscription_invoices (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.profiles(id) on delete restrict,
  period_start date not null,
  period_end   date not null,
  due_date     date not null,
  amount       numeric(14,2) not null check (amount > 0),
  currency     text not null check (currency ~ '^[A-Z]{3}$'),
  status       public.invoice_status not null default 'open',
  created_at   timestamptz not null default now(),
  unique (member_id, period_start),
  check (period_end >= period_start)
);

-- ---------------------------------------------------------------------
-- 8. PAYMENTS + PROVIDER EVENTS
-- ---------------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique
                       default ('PAY-' || lpad(nextval('public.payment_ref_seq')::text, 8, '0')),
  member_id          uuid not null references public.profiles(id) on delete restrict,
  purpose            public.payment_purpose not null,
  amount             numeric(14,2) not null check (amount > 0),
  currency           text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status             public.payment_status not null default 'initiated',
  provider           text not null default 'manual',     -- 'manual' | 'mock_ecocash' | 'ecocash' ...
  provider_reference text,
  idempotency_key    text not null,
  due_item_id        uuid references public.due_items(id),
  invoice_id         uuid references public.subscription_invoices(id),
  evidence_note      text,
  failure_reason     text,
  confirmed_at       timestamptz,
  confirmed_by       uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (member_id, idempotency_key)
);
-- A provider reference can only ever belong to one payment (stops double crediting).
create unique index payments_provider_ref_uq
  on public.payments (provider, provider_reference) where provider_reference is not null;
-- One open payment per due item; one registration fee per member (open or confirmed).
create unique index payments_one_open_per_due_item
  on public.payments (due_item_id) where due_item_id is not null and status in ('initiated', 'pending');
create unique index payments_one_registration
  on public.payments (member_id) where purpose = 'registration_fee' and status in ('initiated', 'pending', 'confirmed');
create index payments_status_idx on public.payments (status, created_at);

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

create or replace function public.payments_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.member_id is distinct from old.member_id
       or new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.purpose is distinct from old.purpose
       or new.reference is distinct from old.reference
       or new.idempotency_key is distinct from old.idempotency_key then
      raise exception 'Payment amount, member, purpose and reference are immutable' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'initiated' and new.status in ('pending', 'confirmed', 'failed', 'rejected'))
      or (old.status = 'pending'   and new.status in ('confirmed', 'failed', 'rejected'))
      or (old.status = 'confirmed' and new.status in ('refunded', 'reversed'))
    ) then
      raise exception 'Invalid payment status transition: % -> %', old.status, new.status
        using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger payments_guard_trg before update on public.payments
  for each row execute function public.payments_guard();

-- Raw provider webhooks/callbacks (written by your Worker with the service role).
create table public.payment_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  event_id        text not null,                 -- provider's unique event/transaction id
  payment_id      uuid references public.payments(id),
  payload         jsonb not null,
  signature_valid boolean not null,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  error           text,
  unique (provider, event_id)                    -- replayed callbacks are rejected here
);

-- ---------------------------------------------------------------------
-- 9. LEDGER (source of truth, append-only)
-- ---------------------------------------------------------------------
create table public.ledger_transactions (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique
                  default ('LDG-' || lpad(nextval('public.ledger_ref_seq')::text, 8, '0')),
  member_id     uuid not null references public.profiles(id) on delete restrict,
  payment_id    uuid references public.payments(id),
  type          public.ledger_type not null,
  amount        numeric(14,2) not null check (amount > 0),
  fee_delta     numeric(14,2) not null default 0,       -- effect on fees paid
  savings_delta numeric(14,2) not null default 0,       -- effect on confirmed savings
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  reverses_id   uuid references public.ledger_transactions(id),
  reason        text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint ledger_shape check (
       (type in ('registration_fee', 'monthly_subscription') and fee_delta = amount and savings_delta = 0)
    or (type = 'savings_contribution' and savings_delta = amount and fee_delta = 0)
    or (type in ('withdrawal', 'refund', 'reversal', 'approved_adjustment'))
  ),
  constraint reversal_linked check (type <> 'reversal' or (reverses_id is not null and reason is not null)),
  constraint reason_required check (type not in ('refund', 'approved_adjustment') or reason is not null)
);
create unique index ledger_one_per_payment
  on public.ledger_transactions (payment_id)
  where type in ('registration_fee', 'monthly_subscription', 'savings_contribution');
create unique index ledger_reversed_once
  on public.ledger_transactions (reverses_id) where reverses_id is not null;
create index ledger_member_idx on public.ledger_transactions (member_id, created_at);

create trigger ledger_no_change before update or delete on public.ledger_transactions
  for each row execute function public.block_mutation();
create trigger ledger_no_truncate before truncate on public.ledger_transactions
  for each statement execute function public.block_mutation();

-- Savings can never go negative (serialised per member to avoid races).
create or replace function public.ledger_guard()
returns trigger language plpgsql as $$
declare v_balance numeric;
begin
  perform pg_advisory_xact_lock(hashtext('ledger:' || new.member_id::text));
  select coalesce(sum(savings_delta), 0) into v_balance
    from public.ledger_transactions
   where member_id = new.member_id and currency = new.currency;
  if v_balance + new.savings_delta < 0 then
    raise exception 'This would make the savings balance negative' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger ledger_guard_trg before insert on public.ledger_transactions
  for each row execute function public.ledger_guard();

-- ---------------------------------------------------------------------
-- 10. AUDIT LOG (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,                       -- null = system / service role
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_logs (entity, entity_id);
create trigger audit_no_change before update or delete on public.audit_logs
  for each row execute function public.block_mutation();
create trigger audit_no_truncate before truncate on public.audit_logs
  for each statement execute function public.block_mutation();

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 11. NOTIFICATIONS
-- ---------------------------------------------------------------------
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.profiles(id) on delete cascade,
  channel             public.notification_channel not null,
  event               text not null,
  subject             text,
  body                text not null,
  status              public.notification_status not null default 'queued',
  attempts            int not null default 0,
  error               text,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);
create index notifications_queue_idx on public.notifications (status, channel) where status = 'queued';
create index notifications_member_idx on public.notifications (member_id, created_at desc);

create table public.notification_templates (
  id      uuid primary key default gen_random_uuid(),
  event   text not null,
  channel public.notification_channel not null,
  subject text,
  body    text not null,
  active  boolean not null default true,
  unique (event, channel)
);

-- Queues in-app always; email / WhatsApp only if the member opted in.
-- A Worker later picks up status = 'queued' rows and sends them.
create or replace function public.queue_notification(p_member uuid, p_event text, p_subject text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_p public.profiles%rowtype;
begin
  select * into v_p from public.profiles where id = p_member;
  if not found then return; end if;
  insert into public.notifications (member_id, channel, event, subject, body, status)
    values (p_member, 'in_app', p_event, p_subject, p_body, 'delivered');
  if v_p.email_opt_in and v_p.email is not null then
    insert into public.notifications (member_id, channel, event, subject, body)
      values (p_member, 'email', p_event, p_subject, p_body);
  end if;
  if v_p.whatsapp_opt_in and v_p.phone is not null then
    insert into public.notifications (member_id, channel, event, subject, body)
      values (p_member, 'whatsapp', p_event, p_subject, p_body);
  end if;
end $$;
revoke all on function public.queue_notification(uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 12. WITHDRAWALS (table exists; hard-disabled until policy approved)
-- ---------------------------------------------------------------------
create table public.withdrawal_requests (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles(id) on delete restrict,
  amount     numeric(14,2) not null check (amount > 0),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  status     public.withdrawal_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.withdrawals_disabled_guard()
returns trigger language plpgsql as $$
begin
  if not coalesce((select value = 'true'::jsonb from public.system_settings where key = 'withdrawals_enabled'), false) then
    raise exception 'Withdrawals are disabled: policy pending owner approval' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger withdrawals_disabled_trg before insert on public.withdrawal_requests
  for each row execute function public.withdrawals_disabled_guard();

-- =====================================================================
-- 13. BUSINESS FUNCTIONS
-- =====================================================================

-- ---- 13a. Member selects a plan ----------------------------------------
create or replace function public.enroll_in_plan(p_plan_version_id uuid, p_accept_terms boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_ver     public.savings_plan_versions%rowtype;
  v_plan    public.savings_plans%rowtype;
  v_enabled jsonb;
  v_id      uuid;
  v_next    date;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_accept_terms is not true then raise exception 'You must accept the plan terms to continue'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.status <> 'active' then
    raise exception 'Your account must be active (registration fee verified) before choosing a plan';
  end if;

  select * into v_ver from public.savings_plan_versions where id = p_plan_version_id;
  if not found or v_ver.status <> 'active' or v_ver.approved_at is null then
    raise exception 'This plan is not available';
  end if;
  select * into v_plan from public.savings_plans where id = v_ver.plan_id;

  select value into v_enabled from public.system_settings where key = 'enabled_frequencies';
  if v_enabled is null or not (v_enabled @> to_jsonb(v_ver.frequency::text)) then
    raise exception 'This plan''s schedule is not enabled';
  end if;
  if v_ver.frequency <> 'weekly' then
    raise exception 'Only weekly schedules are implemented';
  end if;

  if exists (select 1 from public.plan_enrollments
              where member_id = v_uid and status in ('active', 'paused')) then
    raise exception 'You already have a plan. Plan changes require owner-approved rules.';
  end if;

  v_next := current_date + 7;

  insert into public.plan_enrollments (member_id, plan_version_id, accepted_terms, effective_date, next_due_date)
  values (v_uid, v_ver.id,
          jsonb_build_object(
            'plan_name', v_plan.name, 'version', v_ver.version, 'terms_text', v_ver.terms_text,
            'contribution_amount', v_ver.contribution_amount, 'min_amount', v_ver.min_amount,
            'max_amount', v_ver.max_amount, 'currency', v_ver.currency,
            'frequency', v_ver.frequency, 'duration_weeks', v_ver.duration_weeks),
          current_date, v_next)
  returning id into v_id;

  insert into public.due_items (enrollment_id, member_id, due_date, amount, currency)
  values (v_id, v_uid, v_next, v_ver.contribution_amount, v_ver.currency);

  perform public.write_audit('plan.enrolled', 'plan_enrollment', v_id::text,
            jsonb_build_object('plan_version_id', v_ver.id, 'version', v_ver.version));
  perform public.queue_notification(v_uid, 'plan_selected', 'Plan selected',
            'You have joined ' || v_plan.name || '. Your first contribution is due on ' || v_next || '.');
  return v_id;
end $$;
revoke all on function public.enroll_in_plan(uuid, boolean) from public, anon;
grant execute on function public.enroll_in_plan(uuid, boolean) to authenticated, service_role;

-- ---- 13b. Member creates a payment record (pending verification) -------
create or replace function public.create_payment(
  p_purpose         public.payment_purpose,
  p_idempotency_key text,
  p_amount          numeric default null,        -- only used for ranged savings plans
  p_due_item_id     uuid    default null,
  p_invoice_id      uuid    default null,
  p_provider        text    default 'manual',
  p_evidence_note   text    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_existing uuid;
  v_setting  jsonb;
  v_amount   numeric(14,2);
  v_currency text := 'USD';
  v_due      public.due_items%rowtype;
  v_enr      public.plan_enrollments%rowtype;
  v_ver      public.savings_plan_versions%rowtype;
  v_inv      public.subscription_invoices%rowtype;
  v_id       uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;

  -- Same key from the same member = same payment (safe retries).
  select id into v_existing from public.payments
   where member_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.status in ('suspended', 'closed') then
    raise exception 'Your account cannot make payments';
  end if;

  if p_purpose = 'registration_fee' then
    select value into v_setting from public.system_settings where key = 'registration_fee' and approved;
    if v_setting is null then raise exception 'Registration fee is not configured'; end if;
    v_amount   := (v_setting->>'amount')::numeric;
    v_currency := v_setting->>'currency';
    if exists (select 1 from public.payments
                where member_id = v_uid and purpose = 'registration_fee'
                  and status in ('initiated', 'pending', 'confirmed')) then
      raise exception 'A registration fee payment already exists for your account';
    end if;

  elsif p_purpose = 'monthly_subscription' then
    if v_profile.status <> 'active' then raise exception 'Your account is not active yet'; end if;
    if p_invoice_id is not null then
      select * into v_inv from public.subscription_invoices
       where id = p_invoice_id and member_id = v_uid and status in ('open', 'overdue');
      if not found then raise exception 'Invoice not found or already paid'; end if;
      v_amount := v_inv.amount; v_currency := v_inv.currency;
    else
      select value into v_setting from public.system_settings where key = 'monthly_subscription' and approved;
      if v_setting is null then raise exception 'Subscription fee is not configured'; end if;
      v_amount   := (v_setting->>'amount')::numeric;
      v_currency := v_setting->>'currency';
    end if;

  else -- savings_contribution
    if v_profile.status <> 'active' then raise exception 'Your account is not active yet'; end if;
    if p_due_item_id is null then raise exception 'A due contribution is required'; end if;
    select * into v_due from public.due_items
     where id = p_due_item_id and member_id = v_uid and status in ('scheduled', 'due');
    if not found then raise exception 'Contribution not found or already paid'; end if;
    if exists (select 1 from public.payments
                where due_item_id = p_due_item_id and status in ('initiated', 'pending')) then
      raise exception 'A payment for this contribution is already awaiting verification';
    end if;
    select * into v_enr from public.plan_enrollments where id = v_due.enrollment_id;
    if v_enr.status <> 'active' then raise exception 'Your plan is not active'; end if;
    select * into v_ver from public.savings_plan_versions where id = v_enr.plan_version_id;
    v_currency := v_due.currency;
    if v_due.amount is not null then
      v_amount := v_due.amount;                         -- fixed plan amount, ignore client value
    else
      if p_amount is null then raise exception 'Please enter a contribution amount'; end if;
      if p_amount < coalesce(v_ver.min_amount, 0) or p_amount > coalesce(v_ver.max_amount, p_amount) then
        raise exception 'Amount is outside the permitted range for your plan';
      end if;
      v_amount := p_amount;
    end if;
  end if;

  insert into public.payments (member_id, purpose, amount, currency, status, provider,
                               idempotency_key, due_item_id, invoice_id, evidence_note)
  values (v_uid, p_purpose, v_amount, v_currency, 'pending', coalesce(p_provider, 'manual'),
          p_idempotency_key, p_due_item_id, p_invoice_id, p_evidence_note)
  returning id into v_id;

  perform public.write_audit('payment.created', 'payment', v_id::text,
            jsonb_build_object('purpose', p_purpose, 'amount', v_amount, 'currency', v_currency));
  perform public.queue_notification(v_uid, 'payment_submitted', 'Payment received for verification',
            'We received your ' || replace(p_purpose::text, '_', ' ') || ' payment of ' || v_currency || ' ' || v_amount ||
            '. It is pending verification and has not been confirmed yet.');
  return v_id;
end $$;
revoke all on function public.create_payment(public.payment_purpose, text, numeric, uuid, uuid, text, text) from public, anon;
grant execute on function public.create_payment(public.payment_purpose, text, numeric, uuid, uuid, text, text) to authenticated, service_role;

-- ---- 13c. THE ONLY WAY A PAYMENT REACHES THE LEDGER ---------------------
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
            or v_due.due_date + 7 < v_enr.effective_date + (v_ver.duration_weeks * 7)) then
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

-- ---- 13d. Fail / reject a payment --------------------------------------
create or replace function public.fail_payment(
  p_payment_id uuid,
  p_status     public.payment_status default 'failed',
  p_reason     text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_pay public.payments%rowtype;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_status not in ('failed', 'rejected') then
    raise exception 'Status must be failed or rejected';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_pay.status = p_status then return; end if;                      -- idempotent
  if v_pay.status not in ('initiated', 'pending') then
    raise exception 'Payment % is % and cannot be marked %', v_pay.reference, v_pay.status, p_status;
  end if;

  update public.payments set status = p_status, failure_reason = p_reason where id = v_pay.id;

  perform public.write_audit('payment.' || p_status::text, 'payment', v_pay.id::text,
            jsonb_build_object('reference', v_pay.reference, 'reason', p_reason));
  perform public.queue_notification(v_pay.member_id, 'payment_' || p_status::text,
            'Payment ' || p_status::text,
            'Your payment ' || v_pay.reference || ' could not be verified.' ||
            coalesce(' Reason: ' || p_reason, '') || ' No savings were credited.');
end $$;
revoke all on function public.fail_payment(uuid, public.payment_status, text) from public, anon;
grant execute on function public.fail_payment(uuid, public.payment_status, text) to authenticated, service_role;

-- ---- 13e. Reverse a posted ledger row (never delete) -------------------
create or replace function public.reverse_ledger_transaction(p_ledger_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_orig public.ledger_transactions%rowtype;
  v_id   uuid;
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
  end if;

  perform public.write_audit('ledger.reversed', 'ledger_transaction', v_orig.id::text,
            jsonb_build_object('reversal_id', v_id, 'reason', p_reason));
  perform public.queue_notification(v_orig.member_id, 'transaction_reversed', 'Transaction reversed',
            'A transaction on your account (' || v_orig.reference || ') was reversed by our team.');
  return v_id;
end $$;
revoke all on function public.reverse_ledger_transaction(uuid, text) from public, anon;
grant execute on function public.reverse_ledger_transaction(uuid, text) to authenticated, service_role;

-- =====================================================================
-- 14. VIEWS (security_invoker => RLS of the caller applies)
-- =====================================================================
create view public.member_balances with (security_invoker = true) as
select member_id,
       currency,
       coalesce(sum(savings_delta), 0)::numeric(14,2) as confirmed_savings,
       coalesce(sum(fee_delta), 0)::numeric(14,2)     as fees_paid,
       count(*)                                       as transaction_count
  from public.ledger_transactions
 group by member_id, currency;

create view public.payment_verification_queue with (security_invoker = true) as
select p.id, p.reference, p.purpose, p.amount, p.currency, p.status, p.provider,
       p.provider_reference, p.evidence_note, p.created_at,
       pr.member_number, pr.full_name, pr.phone
  from public.payments p
  join public.profiles pr on pr.id = p.member_id
 where p.status in ('initiated', 'pending');

-- =====================================================================
-- 15. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles               enable row level security;
alter table public.user_roles             enable row level security;
alter table public.system_settings        enable row level security;
alter table public.savings_plans          enable row level security;
alter table public.savings_plan_versions  enable row level security;
alter table public.plan_enrollments       enable row level security;
alter table public.due_items              enable row level security;
alter table public.subscription_invoices  enable row level security;
alter table public.payments               enable row level security;
alter table public.payment_events         enable row level security;
alter table public.ledger_transactions    enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.notifications          enable row level security;
alter table public.notification_templates enable row level security;
alter table public.withdrawal_requests    enable row level security;

-- profiles
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

-- user_roles
create policy roles_select on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin());
create policy roles_manage on public.user_roles for all
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

-- settings (public ones are readable by visitors for the Fees page)
create policy settings_select on public.system_settings for select
  using (is_public or public.is_staff());
create policy settings_manage on public.system_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- plans: visitors see only plans that have an active, approved version
create policy plan_versions_select on public.savings_plan_versions for select
  using (status = 'active' or public.is_staff());
create policy plan_versions_manage on public.savings_plan_versions for all
  using (public.is_admin()) with check (public.is_admin());
create policy plans_select on public.savings_plans for select
  using (public.is_staff() or exists (
    select 1 from public.savings_plan_versions v where v.plan_id = savings_plans.id and v.status = 'active'));
create policy plans_manage on public.savings_plans for all
  using (public.is_admin()) with check (public.is_admin());

-- member-owned, read-only from the client (all writes go through functions)
create policy enrollments_select on public.plan_enrollments for select
  using (member_id = auth.uid() or public.is_staff());
create policy due_items_select on public.due_items for select
  using (member_id = auth.uid() or public.is_staff());
create policy payments_select on public.payments for select
  using (member_id = auth.uid() or public.is_staff());
create policy ledger_select on public.ledger_transactions for select
  using (member_id = auth.uid() or public.is_staff());
create policy notifications_select on public.notifications for select
  using (member_id = auth.uid() or public.is_staff());
create policy withdrawals_select on public.withdrawal_requests for select
  using (member_id = auth.uid() or public.is_staff());

-- invoices: members read own, admins manage
create policy invoices_select on public.subscription_invoices for select
  using (member_id = auth.uid() or public.is_staff());
create policy invoices_manage on public.subscription_invoices for all
  using (public.is_admin()) with check (public.is_admin());

-- admin-only
create policy payment_events_select on public.payment_events for select using (public.is_admin());
create policy audit_select          on public.audit_logs      for select using (public.is_admin());
create policy templates_select      on public.notification_templates for select using (public.is_staff());
create policy templates_manage      on public.notification_templates for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Table privileges: defence in depth on top of RLS
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert, update, delete, truncate on
  public.plan_enrollments, public.due_items, public.payments, public.payment_events,
  public.ledger_transactions, public.audit_logs, public.notifications, public.withdrawal_requests
  from authenticated;
-- Visitors may read public plan + fee info (RLS limits rows)
grant select on public.system_settings, public.savings_plans, public.savings_plan_versions to anon;

-- =====================================================================
-- 16. SEED DATA
-- =====================================================================
-- Confirmed by owner: registration fee, subscription fee, weekly baseline.
insert into public.system_settings (key, value, description, is_public, approved) values
  ('registration_fee',     '{"amount": "20.00", "currency": "USD"}', 'One-time registration fee (owner confirmed)', true,  true),
  ('monthly_subscription', '{"amount": "5.00",  "currency": "USD"}', 'Monthly subscription fee (owner confirmed)',  true,  true),
  ('enabled_frequencies',  '["weekly"]',                              'Schedules offered at launch',                 true,  true),
  ('withdrawals_enabled',  'false',                                   'Master switch. Policy pending owner approval', true, true),
  ('payment_mode',         '"manual"',                                'manual | mock_ecocash | ecocash',             false, true)
on conflict (key) do nothing;

-- Clearly fake DRAFT plans so the UI has something to render. They cannot be
-- offered to members until an admin adds owner-approved amounts and activates them.
with p as (
  insert into public.savings_plans (name, description)
  values ('Sample Plan A (PLACEHOLDER)', 'Placeholder only. Amounts pending owner approval.')
  returning id)
insert into public.savings_plan_versions (plan_id, version, status, terms_text)
select id, 1, 'draft', 'PLACEHOLDER TERMS. To be replaced after owner approval.' from p;

with p as (
  insert into public.savings_plans (name, description)
  values ('Sample Plan B (PLACEHOLDER)', 'Placeholder only. Amounts pending owner approval.')
  returning id)
insert into public.savings_plan_versions (plan_id, version, status, terms_text)
select id, 1, 'draft', 'PLACEHOLDER TERMS. To be replaced after owner approval.' from p;

commit;

-- =====================================================================
-- AFTER RUNNING: make yourself the first super admin
-- (sign up in the app first, then run this with your email):
--
--   insert into public.user_roles (user_id, role)
--   select id, 'super_admin' from auth.users where email = 'you@example.com'
--   on conflict do nothing;
-- =====================================================================
