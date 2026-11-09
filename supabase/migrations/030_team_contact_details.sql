-- 030: team members can have a phone number and email shown on the Contact page.
-- Contact details live in their own table so they can never leak: the public can read a row
-- only when staff ticked "Show on the Contact page" AND the person is published on the team.
-- Staff (admins) can read and change every row.

create table if not exists public.team_contact_details (
  member_id       uuid primary key references public.team_members(id) on delete cascade,
  phone           text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email           text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  show_on_contact boolean not null default false,
  updated_at      timestamptz not null default now(),
  -- Ticking "show" with nothing to show would give an empty card.
  check (not show_on_contact or phone is not null or email is not null)
);

drop trigger if exists team_contact_details_touch on public.team_contact_details;
create trigger team_contact_details_touch before update on public.team_contact_details
  for each row execute function public.touch_updated_at();

alter table public.team_contact_details enable row level security;

drop policy if exists team_contact_read on public.team_contact_details;
create policy team_contact_read on public.team_contact_details for select using (
  public.is_admin()
  or (show_on_contact
      and exists (select 1 from public.team_members m
                  where m.id = member_id and m.published)));

drop policy if exists team_contact_manage on public.team_contact_details;
create policy team_contact_manage on public.team_contact_details for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.team_contact_details from anon, authenticated;
grant select on public.team_contact_details to anon, authenticated;
grant insert, update, delete on public.team_contact_details to authenticated;
