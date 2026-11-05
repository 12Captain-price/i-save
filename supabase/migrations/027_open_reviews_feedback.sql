-- 027: reviews and feedback are open to visitors and clients. No sign-in needed.
--
-- Reviews: anyone can send one. It always starts as "pending" and only shows on the website
-- after staff approve it, so nothing unchecked ever goes live.
--
-- Feedback: anyone can send a message, but because there is no account to look up, the sender
-- gives a name and a phone number or email so staff know who to reply to. Only staff can read it.
--
-- Spam protection: the database limits how many anonymous reviews and messages can arrive per
-- hour, and the website form has a hidden trap field that bots fill in.
--
-- Run once in the Supabase SQL editor, after 026.

-- ---------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------
create or replace function public.reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null and coalesce(auth.role(), 'anon') <> 'service_role' then
      -- A visitor with no account: always pending, nobody's name attached, capped per hour.
      new.status := 'pending';
      new.submitted_by := null;
      new.approved_by := null;
      new.approved_at := null;
      select count(*) into recent from public.reviews
        where submitted_by is null and status = 'pending'
          and created_at > now() - interval '1 hour';
      if recent >= 10 then
        raise exception 'We are getting a lot of reviews right now. Please try again in a little while.'
          using errcode = '54000';
      end if;
    elsif auth.uid() is not null and not coalesce(public.is_staff(), false) then
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

drop policy if exists reviews_member_submit on public.reviews;
drop policy if exists reviews_public_submit on public.reviews;
create policy reviews_public_submit on public.reviews for insert
  with check (status = 'pending' and (submitted_by is null or submitted_by = auth.uid()));

grant insert on public.reviews to anon;

-- ---------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------
alter table public.feedback alter column user_id drop not null;
alter table public.feedback alter column user_id drop default;
alter table public.feedback add column if not exists sender_name  text;
alter table public.feedback add column if not exists sender_phone text;
alter table public.feedback add column if not exists sender_email text;

alter table public.feedback drop constraint if exists feedback_sender_check;
alter table public.feedback add constraint feedback_sender_check check (
  (sender_name  is null or char_length(trim(sender_name))  between 2 and 80) and
  (sender_phone is null or char_length(sender_phone) <= 30) and
  (sender_email is null or char_length(sender_email) <= 120)
);

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
    else
      -- A visitor with no account: we need a name and a way to reply.
      new.user_id := null;
      if new.sender_name is null or char_length(trim(new.sender_name)) < 2 then
        raise exception 'Please tell us your name.' using errcode = '23514';
      end if;
      if coalesce(trim(new.sender_phone), '') = '' and coalesce(trim(new.sender_email), '') = '' then
        raise exception 'Please add a phone number or an email so we can reply.' using errcode = '23514';
      end if;
      select count(*) into recent from public.feedback
        where user_id is null and created_at > now() - interval '1 hour';
      if recent >= 20 then
        raise exception 'We are getting a lot of messages right now. Please try again in a little while.'
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

drop policy if exists feedback_member_send on public.feedback;
drop policy if exists feedback_public_send on public.feedback;
create policy feedback_public_send on public.feedback for insert
  with check (user_id is null or user_id = auth.uid());

grant insert on public.feedback to anon;
