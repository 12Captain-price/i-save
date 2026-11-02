-- 009: editable site content (pages, FAQs), announcements, team and events, with image storage.
-- Visitors read only what is published. Only admins write. Sending an announcement queues
-- in-app, email and WhatsApp notifications for opted-in active members, once.

-- ---------------------------------------------------------------------
-- Pages (terms, privacy, disclosures)
-- ---------------------------------------------------------------------
create table public.site_pages (
  key        text primary key check (key in ('terms', 'privacy', 'disclosures')),
  title      text not null check (length(trim(title)) > 0),
  body       text not null default '',
  published  boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create trigger site_pages_touch before update on public.site_pages
  for each row execute function public.touch_updated_at();

create table public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (length(trim(question)) > 0),
  answer     text not null check (length(trim(answer)) > 0),
  sort_order int  not null default 100,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger faqs_touch before update on public.faqs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------
create table public.announcements (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(trim(title)) > 0),
  body                text not null check (length(trim(body)) > 0),
  published           boolean not null default false,
  published_at        timestamptz,
  send_email          boolean not null default true,
  send_whatsapp       boolean not null default true,
  sent_at             timestamptz,
  sent_by             uuid references auth.users(id) on delete set null,
  recipients_in_app   int,
  recipients_email    int,
  recipients_whatsapp int,
  created_by          uuid references auth.users(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();

create or replace function public.announcements_guard()
returns trigger language plpgsql as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) and new.published_at is null then
    new.published_at := now();
  end if;
  -- Send bookkeeping is written only by send_announcement().
  if tg_op = 'UPDATE' and auth.uid() is not null
     and coalesce(current_setting('app.sending_announcement', true), '') <> 'on' then
    if new.sent_at is distinct from old.sent_at
       or new.sent_by is distinct from old.sent_by
       or new.recipients_in_app is distinct from old.recipients_in_app
       or new.recipients_email is distinct from old.recipients_email
       or new.recipients_whatsapp is distinct from old.recipients_whatsapp then
      raise exception 'Sending details cannot be edited' using errcode = '42501';
    end if;
    if old.sent_at is not null
       and (new.title is distinct from old.title or new.body is distinct from old.body) then
      raise exception 'This announcement has already been sent, so its text can no longer be changed'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger announcements_guard_trg before insert or update on public.announcements
  for each row execute function public.announcements_guard();

-- ---------------------------------------------------------------------
-- Team (level 1 is the top of the hierarchy)
-- ---------------------------------------------------------------------
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (length(trim(full_name)) > 0),
  role_title text not null check (length(trim(role_title)) > 0),
  bio        text,
  photo_path text,
  level      smallint not null default 1 check (level between 1 and 6),
  sort_order int not null default 100,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger team_members_touch before update on public.team_members
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Events and their pictures
-- ---------------------------------------------------------------------
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  event_date date not null,
  location   text,
  summary    text,
  details    text,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create table public.event_images (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  path       text not null,
  caption    text,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create index event_images_event_idx on public.event_images (event_id, sort_order);

-- ---------------------------------------------------------------------
-- Row-level security: visitors read what is published, admins do everything
-- ---------------------------------------------------------------------
alter table public.site_pages    enable row level security;
alter table public.faqs          enable row level security;
alter table public.announcements enable row level security;
alter table public.team_members  enable row level security;
alter table public.events        enable row level security;
alter table public.event_images  enable row level security;

create policy site_pages_read on public.site_pages for select using (published or public.is_admin());
create policy site_pages_edit on public.site_pages for update
  using (public.is_admin()) with check (public.is_admin());

create policy faqs_read   on public.faqs for select using (published or public.is_admin());
create policy faqs_manage on public.faqs for all
  using (public.is_admin()) with check (public.is_admin());

create policy announcements_read   on public.announcements for select using (published or public.is_admin());
create policy announcements_manage on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

create policy team_read   on public.team_members for select using (published or public.is_admin());
create policy team_manage on public.team_members for all
  using (public.is_admin()) with check (public.is_admin());

create policy events_read   on public.events for select using (published or public.is_admin());
create policy events_manage on public.events for all
  using (public.is_admin()) with check (public.is_admin());

create policy event_images_read on public.event_images for select using (
  public.is_admin()
  or exists (select 1 from public.events e where e.id = event_id and e.published));
create policy event_images_manage on public.event_images for all
  using (public.is_admin()) with check (public.is_admin());

-- Table privileges: defence in depth on top of RLS (Supabase grants broadly by default).
revoke all on public.site_pages, public.faqs, public.announcements,
  public.team_members, public.events, public.event_images from anon, authenticated;
grant select on public.site_pages, public.faqs, public.announcements,
  public.team_members, public.events, public.event_images to anon, authenticated;
grant insert, update, delete on public.faqs, public.announcements, public.team_members,
  public.events, public.event_images to authenticated;
grant update on public.site_pages to authenticated;

-- ---------------------------------------------------------------------
-- Sending an announcement
-- ---------------------------------------------------------------------
-- Queues one in-app message for every active member, plus email and WhatsApp for those who
-- opted in (and only for the channels the announcement is set to use). Works once per
-- announcement; the row is locked so two clicks cannot send it twice.
-- Email rows are sent by the Worker. WhatsApp rows wait in the staff outbox until a person
-- sends them (or until an automatic WhatsApp Business sender exists).
create or replace function public.send_announcement(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_a public.announcements%rowtype;
  n_app int; n_email int := 0; n_wa int := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can send announcements' using errcode = '42501';
  end if;
  select * into v_a from public.announcements where id = p_id for update;
  if not found then raise exception 'Announcement not found'; end if;
  if v_a.sent_at is not null then raise exception 'This announcement has already been sent'; end if;
  if not v_a.published then raise exception 'Publish the announcement before sending it'; end if;

  insert into public.notifications (member_id, channel, event, subject, body, status)
    select id, 'in_app', 'announcement', v_a.title, v_a.body, 'delivered'
    from public.profiles where status = 'active';
  get diagnostics n_app = row_count;

  if v_a.send_email then
    insert into public.notifications (member_id, channel, event, subject, body)
      select id, 'email', 'announcement', v_a.title, v_a.body
      from public.profiles
      where status = 'active' and email_opt_in and email is not null;
    get diagnostics n_email = row_count;
  end if;

  if v_a.send_whatsapp then
    insert into public.notifications (member_id, channel, event, subject, body)
      select id, 'whatsapp', 'announcement', v_a.title, v_a.body
      from public.profiles
      where status = 'active' and whatsapp_opt_in and phone is not null;
    get diagnostics n_wa = row_count;
  end if;

  perform set_config('app.sending_announcement', 'on', true);
  update public.announcements
     set sent_at = now(), sent_by = auth.uid(),
         recipients_in_app = n_app, recipients_email = n_email, recipients_whatsapp = n_wa
   where id = p_id;
  perform set_config('app.sending_announcement', '', true);

  perform public.write_audit('announcement_sent', 'announcement', p_id::text,
    jsonb_build_object('in_app', n_app, 'email', n_email, 'whatsapp', n_wa));
  return jsonb_build_object('in_app', n_app, 'email', n_email, 'whatsapp', n_wa);
end $$;
revoke all on function public.send_announcement(uuid) from public, anon;
grant execute on function public.send_announcement(uuid) to authenticated;

-- Staff mark WhatsApp messages as sent after sending them by hand from the outbox.
create or replace function public.mark_whatsapp_sent(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Only staff can do this' using errcode = '42501';
  end if;
  update public.notifications
     set status = 'sent', sent_at = now()
   where id = any(p_ids) and channel = 'whatsapp' and status = 'queued';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_whatsapp_sent(uuid[]) from public, anon;
grant execute on function public.mark_whatsapp_sent(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Image storage (Supabase Storage). Skipped on the local test database, which has no storage.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('site-media', 'site-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute 'create policy site_media_insert on storage.objects for insert to authenticated
             with check (bucket_id = ''site-media'' and public.is_admin())';
    execute 'create policy site_media_update on storage.objects for update to authenticated
             using (bucket_id = ''site-media'' and public.is_admin())';
    execute 'create policy site_media_delete on storage.objects for delete to authenticated
             using (bucket_id = ''site-media'' and public.is_admin())';
  end if;
end $$;

-- Seed: the FAQs and page text that were previously hard-coded in the web app.
insert into public.site_pages (key, title, body) values
  ('terms', $t$Terms and conditions$t$, $t$## Membership
You can apply online or be registered by office staff. You must be old enough to enter into this agreement, give true details, and have a valid email address.

Each person may hold one account. Staff check your physical national ID at the office, and your account becomes active when that check is done and your registration fee is confirmed.

## Fees
A one-time registration fee and a monthly subscription apply. They are fees for running the organisation. They are recorded separately from your savings and never count towards your savings balance. Current amounts are on the [Fees page](/fees). Fees may be changed only by the organisation, and the new amounts are published before they apply.

## Savings plans and contributions
You may join a plan the organisation has approved. You read and accept that plan’s terms before you join, and an approved plan’s terms are not changed for existing members; a change needs a new version.

Contributions are weekly and are paid at the office. A contribution counts only once staff have recorded and confirmed it, and you receive a numbered receipt.

## Records and corrections
Every money event is kept in a ledger that cannot be edited or deleted. If a record is wrong, staff correct it with a visible reversal and a written reason, and you are notified. Please check your receipts and tell the office quickly if anything looks wrong.

## No interest or returns
The organisation does not offer, calculate or promise interest, bonuses or investment returns. Your savings balance is the total of your confirmed contributions.

## Withdrawals
Withdrawals are not open yet. The withdrawal policy will be published, and shown in your account, before any withdrawal can be requested.

## Your account and notifications
Keep your password private and tell the office if you think someone else has used your account. We send you messages about your account in the app and by email. WhatsApp messages are sent only if you opt in separately. See the [Privacy notice](/privacy).

## Changes to these terms
The organisation may update these terms. Changes are published on this page before they apply.

## Questions
Contact the office using the details below.

{{contact}}$t$),
  ('privacy', $t$Privacy notice$t$, $t$## What we collect
Your full name, email address, phone number and national ID number; the savings category you are interested in; your payments, receipts and plan choices; your notification choices; and a record of staff actions on your account. We do not collect ID document uploads or photographs.

## Why we collect it
To run your membership: to make sure each person has one account, to record your payments accurately, to contact you about your account, and to keep a trustworthy record that can be checked.

## Who can see it
You can see your own records only. Office staff can see member records as far as their role needs. Your national ID number is visible to staff only, and each time it is opened, that is recorded in an audit log.

We do not sell your information or use it for advertising.

## Services we use
Your data is stored with our database and sign-in provider (Supabase), the website runs on Cloudflare, and emails are sent through an email delivery provider. These providers handle data only to provide those services to us.

## Messages
Account messages appear in the app and are sent to your email. Announcements and other WhatsApp messages are sent only if you opt in, and you can opt out again by telling the office.

## How long we keep it
Payment records and audit logs are permanent by design, so that the money history can always be checked. The retention period for other personal details will be confirmed by the organisation.

## Your choices
You can ask the office to see or correct your details. Some records, such as payments, cannot be deleted because the ledger must stay complete; they can be corrected only by a visible reversal.

## Contact
For privacy questions, use the details below.

{{contact}}$t$),
  ('disclosures', $t$Risk and withdrawal disclosure$t$, $t$## No interest, bonuses or returns
i-Save is a place to save. It does not offer interest, bonuses or investment returns, and nothing on this site promises growth.

## Withdrawals are not open
The withdrawal policy is waiting for the organisation’s approval. You cannot request a withdrawal until it is published. Please consider this before you start saving.

## Fees are not savings
Registration and subscription fees are kept separate from your savings and are not part of your savings balance. See the [Fees page](/fees).

## Currency
Amounts are in US dollars for now. Any change of currency will be announced before it applies.

## Not financial advice
Nothing on this site is financial advice. Choose a plan that suits your own situation, and ask the office if you are unsure.$t$)
on conflict (key) do nothing;

insert into public.faqs (question, answer, sort_order) values
  ($t$Who can join?$t$, $t$You can apply online, or ask the office to register you. You need a valid email address; the office can help you create one. You also confirm your age and accept the terms when you apply.$t$, 10),
  ($t$What do I pay to join?$t$, $t$A one-time registration fee of US$20, paid at the office. It is a fee, not savings, so it does not count towards your savings balance.$t$, 20),
  ($t$Is there a monthly charge?$t$, $t$Yes. A small monthly subscription of US$5 covers your membership. It is separate from your savings and never reduces them.$t$, 30),
  ($t$When does my account become active?$t$, $t$Once staff have checked your national ID at the office and recorded your registration fee. Until then your account shows as pending.$t$, 40),
  ($t$Why do you check my ID?$t$, $t$Staff look at your physical national ID so that each person has one account only. Only staff can see your ID number, and every time it is opened, the opening is recorded.$t$, 50),
  ($t$How do I pay?$t$, $t$Payments are made at the office at the moment. Staff record each payment and give you a numbered receipt, and it appears in your account straight away.$t$, 60),
  ($t$How do I see what I have saved?$t$, $t$Log in and open your account. It shows your confirmed savings, your fees (shown separately), your plan, your receipts and your messages.$t$, 70),
  ($t$What if a payment was recorded wrongly?$t$, $t$Records are never edited or deleted. A mistake is corrected with a visible reversal and a reason, and you receive a message about it.$t$, 80),
  ($t$Do I earn interest or returns?$t$, $t$No. i-Save is a place to save. It does not offer interest, bonuses or investment returns.$t$, 90),
  ($t$Can I withdraw my savings?$t$, $t$Not yet. The withdrawal policy is waiting for the organisation’s approval. It will be published, and shown in your account, before withdrawals open.$t$, 100),
  ($t$Can I choose how much to save?$t$, $t$You choose from the plans the organisation has approved. You read and accept the terms of a plan before you join it. Contributions are weekly.$t$, 110),
  ($t$Is my information private?$t$, $t$A member can only see their own records. Staff access is limited to staff roles, and staff actions are recorded in an audit log.$t$, 120),
  ($t$What savings plans are there?$t$, $t$The organisation offers five categories: Asset, Holiday, Emergency, Retrenchment and Education. A plan is only open to join once the organisation has approved its amount and terms, so you may see some still being prepared.$t$, 130),
  ($t$How often do I contribute?$t$, $t$Weekly, at the office. Each contribution is recorded by staff and gets its own numbered receipt.$t$, 140),
  ($t$How do I log in, and what if I forget my password?$t$, $t$Log in with your email address and password. If you forget it, use “Forgot password” on the login page and we email you a link to set a new one. If the office registered you, you set your first password from the link in your welcome email.$t$, 150),
  ($t$I do not have an email address. Can I still join?$t$, $t$Yes. An email address is needed for your login and messages, so the office will help you create one when you register.$t$, 160),
  ($t$How will I hear from you?$t$, $t$Messages about your account appear in your account and are sent to your email. Announcements may also reach you on WhatsApp if you opt in. WhatsApp is never used to log in.$t$, 170),
  ($t$Do I pay online or by mobile money?$t$, $t$Not yet. Payments are made at the office. Mobile money (EcoCash) is planned for later, and we will tell members before it starts.$t$, 180),
  ($t$What happens if I miss a payment?$t$, $t$The rules for late or missed payments are still waiting for the organisation’s decision. They will be published before they apply. Nothing is charged for lateness today.$t$, 190),
  ($t$Can I change or leave my plan?$t$, $t$Plan terms are fixed once approved, so you know what you agreed to. Rules for changing or leaving a plan, and for withdrawals, are waiting for the organisation’s approval. Please ask the office if you need to discuss your situation.$t$, 200),
  ($t$Which currency is used?$t$, $t$US dollars for now. Any change will be announced before it applies.$t$, 210),
  ($t$What if I think someone else used my account?$t$, $t$Contact the office straight away. Staff can check your records and every action on them is logged.$t$, 220),
  ($t$Where is the office, and how do I reach it?$t$, $t${{contact}}$t$, 230);
