-- 013: staff who members can reach on WhatsApp ("Ask for assistance").
--
-- Why a separate table: the public Team page is readable by anyone, so staff phone numbers
-- must never go there. These rows are readable only by signed-in people (members and staff),
-- and only admins can add, change or remove them. The number is E.164, so wa.me links work.

create table public.support_contacts (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null check (length(trim(full_name)) > 0),
  role_title     text not null check (length(trim(role_title)) > 0),
  whatsapp_phone text not null check (whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$'),
  sort_order     int not null default 100,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger support_contacts_touch before update on public.support_contacts
  for each row execute function public.touch_updated_at();

alter table public.support_contacts enable row level security;

create policy support_contacts_read on public.support_contacts for select
  using (auth.uid() is not null and (active or public.is_admin()));
create policy support_contacts_manage on public.support_contacts for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.support_contacts from anon, authenticated;
grant select on public.support_contacts to authenticated;
grant insert, update, delete on public.support_contacts to authenticated;
