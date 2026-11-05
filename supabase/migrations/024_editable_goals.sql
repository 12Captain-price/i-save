-- 024: savings goals become fully editable. Admins can add a goal, rename it, pick its icon and
-- colour, reorder, hide it from the website, or delete it (the five original goals can be hidden
-- but not deleted).
--
-- Run this in the Supabase SQL editor. It is safe to run once. The website keeps working with
-- the built-in five goals until it is run.
--
-- label / purpose   null on an original goal means "use the built-in wording".
-- sort_order        lowest first.
-- active            false hides the goal from the home page and the Plans filter.
-- builtin           true for the five original goals. They cannot be deleted.

alter table public.goal_content
  add column if not exists label      text
    check (label is null or char_length(label) between 2 and 30),
  add column if not exists purpose    text
    check (purpose is null or char_length(purpose) <= 160),
  add column if not exists icon       text    not null default 'target',
  add column if not exists accent     text    not null default 'green',
  add column if not exists sort_order integer not null default 100,
  add column if not exists active     boolean not null default true,
  add column if not exists builtin    boolean not null default false;

-- Any short web-safe code is allowed as a goal key now, not just the original five.
alter table public.goal_content drop constraint if exists goal_content_key_check;
alter table public.goal_content
  add constraint goal_content_key_format
  check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
         and char_length(key) between 2 and 30
         and key not in ('all', 'combo', 'other'));

update public.goal_content set builtin = true,
  icon = case key when 'asset' then 'building' when 'holiday' then 'plane'
                  when 'emergency' then 'shield' when 'retrenchment' then 'briefcase'
                  else 'graduation' end,
  accent = case key when 'asset' then 'gold' when 'holiday' then 'blue'
                    when 'emergency' then 'red' when 'retrenchment' then 'purple'
                    else 'green' end,
  sort_order = case key when 'asset' then 10 when 'holiday' then 20
                        when 'emergency' then 30 when 'retrenchment' then 40
                        else 50 end
where key in ('asset','holiday','emergency','retrenchment','education');

-- Admins may add goals, and delete the ones they added.
drop policy if exists goal_content_add on public.goal_content;
create policy goal_content_add on public.goal_content for insert
  with check (public.is_admin() and builtin = false);
drop policy if exists goal_content_remove on public.goal_content;
create policy goal_content_remove on public.goal_content for delete
  using (public.is_admin() and builtin = false);

grant insert, delete on public.goal_content to authenticated;

-- A plan's theme follows the goal key, so new goals can be used as plan themes too.
alter table public.savings_plans drop constraint if exists savings_plans_theme_check;
alter table public.savings_plans drop constraint if exists savings_plans_theme_format;
alter table public.savings_plans
  add constraint savings_plans_theme_format
  check (theme ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(theme) <= 30);
