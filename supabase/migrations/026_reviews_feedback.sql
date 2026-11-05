-- 026: member reviews (shown on the home page once approved) and the feedback inbox.
--
-- Reviews: signed-in members can write one; it waits as "pending" until staff or an admin
-- approves it. Staff can also add, edit, reorder, reject and delete reviews themselves.
-- Visitors see approved reviews only.
--
-- Feedback: signed-in members send feedback, requests, ideas or complaints. Only staff can
-- read the whole inbox; a member sees only their own messages. Staff mark messages as seen
-- or resolved and can keep a private note. Members never see the note.
--
-- Run once in the Supabase SQL editor.

-- ---------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  author_name  text not null check (char_length(trim(author_name)) between 2 and 80),
  author_title text check (author_title is null or char_length(author_title) <= 80),
  rating       smallint not null default 5 check (rating between 1 and 5),
  body         text not null check (char_length(trim(body)) between 10 and 800),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  sort_order   int not null default 100,
  submitted_by uuid references auth.users(id) on delete set null,
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists reviews_status_idx on public.reviews (status, sort_order, created_at desc);

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

create or replace function public.reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not coalesce(public.is_staff(), false) then
      -- Members can only submit pending reviews in their own name, a few per day at most.
      new.status := 'pending';
      new.submitted_by := auth.uid();
      new.approved_by := null;
      new.approved_at := null;
      select count(*) into recent from public.reviews
        where submitted_by = auth.uid() and created_at > now() - interval '1 day';
      if recent >= 3 then
        raise exception 'You have sent a few reviews today already. Please try again tomorrow.'
          using errcode = '54000';
      end if;
    elsif new.submitted_by is null then
      new.submitted_by := auth.uid();
    end if;
  end if;

  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;

drop trigger if exists reviews_guard_trg on public.reviews;
create trigger reviews_guard_trg before insert or update on public.reviews
  for each row execute function public.reviews_guard();

alter table public.reviews enable row level security;

drop policy if exists reviews_read_public on public.reviews;
create policy reviews_read_public on public.reviews for select
  using (status = 'approved');
drop policy if exists reviews_read_own on public.reviews;
create policy reviews_read_own on public.reviews for select
  using (submitted_by = auth.uid());
drop policy if exists reviews_read_staff on public.reviews;
create policy reviews_read_staff on public.reviews for select
  using (public.is_staff());

drop policy if exists reviews_member_submit on public.reviews;
create policy reviews_member_submit on public.reviews for insert
  with check (auth.uid() is not null and submitted_by = auth.uid() and status = 'pending');
drop policy if exists reviews_staff_add on public.reviews;
create policy reviews_staff_add on public.reviews for insert
  with check (public.is_staff());
drop policy if exists reviews_staff_edit on public.reviews;
create policy reviews_staff_edit on public.reviews for update
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists reviews_staff_remove on public.reviews;
create policy reviews_staff_remove on public.reviews for delete
  using (public.is_staff());

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

-- ---------------------------------------------------------------------
-- Feedback inbox
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null default 'feedback' check (kind in ('feedback', 'request', 'idea', 'complaint')),
  subject    text not null check (char_length(trim(subject)) between 3 and 120),
  message    text not null check (char_length(trim(message)) between 10 and 2000),
  status     text not null default 'new' check (status in ('new', 'seen', 'resolved')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 1000),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_inbox_idx on public.feedback (status, created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

drop trigger if exists feedback_touch on public.feedback;
create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_updated_at();

create or replace function public.feedback_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent int;
begin
  if tg_op = 'INSERT' then
    new.status := 'new';
    new.staff_note := null;
    new.handled_by := null;
    new.handled_at := null;
    if auth.uid() is not null then
      new.user_id := auth.uid();
      select count(*) into recent from public.feedback
        where user_id = auth.uid() and created_at > now() - interval '1 day';
      if recent >= 10 then
        raise exception 'You have sent a lot of messages today. Please try again tomorrow.'
          using errcode = '54000';
      end if;
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'new' then
      new.handled_by := null;
      new.handled_at := null;
    else
      new.handled_by := auth.uid();
      new.handled_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists feedback_guard_trg on public.feedback;
create trigger feedback_guard_trg before insert or update on public.feedback
  for each row execute function public.feedback_guard();

alter table public.feedback enable row level security;

drop policy if exists feedback_member_send on public.feedback;
create policy feedback_member_send on public.feedback for insert
  with check (auth.uid() is not null and user_id = auth.uid());
drop policy if exists feedback_member_read on public.feedback;
create policy feedback_member_read on public.feedback for select
  using (user_id = auth.uid());
drop policy if exists feedback_staff_read on public.feedback;
create policy feedback_staff_read on public.feedback for select
  using (public.is_staff());
drop policy if exists feedback_staff_handle on public.feedback;
create policy feedback_staff_handle on public.feedback for update
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists feedback_admin_remove on public.feedback;
create policy feedback_admin_remove on public.feedback for delete
  using (public.is_admin());

revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
-- Staff may only change the status and their private note, never what the member wrote.
grant update (status, staff_note) on public.feedback to authenticated;
grant delete on public.feedback to authenticated;
