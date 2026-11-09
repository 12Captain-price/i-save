-- 029: "new" badges and attachments.
--  * events get a publish date (announcements already have one), so the site can tell what is new;
--  * announcements can carry pictures, fliers (PDF) and videos, like events do.
-- Files live in the existing site-media bucket (allowed types were set in 028).

-- ---------------------------------------------------------------------
-- Events: when each one went on the website
-- ---------------------------------------------------------------------
alter table public.events add column if not exists published_at timestamptz;

update public.events set published_at = created_at
 where published and published_at is null;

create or replace function public.events_publish_stamp()
returns trigger language plpgsql as $$
begin
  if new.published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists events_publish_stamp_trg on public.events;
create trigger events_publish_stamp_trg before insert or update on public.events
  for each row execute function public.events_publish_stamp();

-- ---------------------------------------------------------------------
-- Announcement attachments
-- ---------------------------------------------------------------------
create table if not exists public.announcement_files (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  path            text not null,
  caption         text,
  sort_order      int not null default 100,
  media_type      text not null default 'image' check (media_type in ('image', 'video', 'pdf')),
  file_name       text,
  created_at      timestamptz not null default now()
);
create index if not exists announcement_files_idx
  on public.announcement_files (announcement_id, sort_order);

alter table public.announcement_files enable row level security;

create policy announcement_files_read on public.announcement_files for select using (
  public.is_admin()
  or exists (select 1 from public.announcements a where a.id = announcement_id and a.published));
create policy announcement_files_manage on public.announcement_files for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.announcement_files from anon, authenticated;
grant select on public.announcement_files to anon, authenticated;
grant insert, update, delete on public.announcement_files to authenticated;
