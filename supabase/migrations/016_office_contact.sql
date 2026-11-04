-- 016: office contact details that admins can edit (phones, WhatsApp, email, address, hours).
-- These were typed into the web app's code. They now live in one row that the Contact page,
-- the assistance panel and printed receipts read. Anyone may read it (it is public contact
-- information); only admins may change it. The row cannot be added to or deleted.

create table public.office_contact (
  id         int primary key default 1 check (id = 1),
  phones     jsonb not null default '[]'::jsonb check (jsonb_typeof(phones) = 'array'),
  whatsapp   text check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$'),
  email      text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address    text,
  hours      text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create trigger office_contact_touch before update on public.office_contact
  for each row execute function public.touch_updated_at();

alter table public.office_contact enable row level security;
create policy office_contact_read on public.office_contact for select using (true);
create policy office_contact_edit on public.office_contact for update
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.office_contact from anon, authenticated;
grant select on public.office_contact to anon, authenticated;
grant update on public.office_contact to authenticated;

-- The details approved by the owner so far.
insert into public.office_contact (id, phones, whatsapp, email, address, hours) values (
  1,
  '[{"label":"Office landline","value":"+263 29 226 1341"},
    {"label":"Director","value":"+263 78 552 1029"},
    {"label":"Additional contact","value":"+263 78 663 9536"}]'::jsonb,
  '263786639536',
  'zpyfinfo@gmail.com',
  '5th floor, Office 511, Yolk House, Bulawayo, Zimbabwe',
  null
) on conflict (id) do nothing;
