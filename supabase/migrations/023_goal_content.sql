-- 023: the text in each savings-goal panel on the home page, editable by admins.
-- One row per goal. A column left empty (null) means "use the built-in text", so these rows
-- start out empty and the panels look exactly as they do now.
--
-- content_is_real  false: the panel says "Sample content. Figures and quotes below are
--                  illustrative." true: the label is hidden. Set it only when every figure
--                  is a real record and every quote is a real member's, used with permission.

create table public.goal_content (
  key             text primary key
                  check (key in ('asset','holiday','emergency','retrenchment','education')),
  about           text check (about is null or char_length(about) <= 600),
  how             text[] check (how is null or cardinality(how) <= 6),
  past            text[] check (past is null or cardinality(past) <= 6),
  present         text[] check (present is null or cardinality(present) <= 6),
  ahead           text[] check (ahead is null or cardinality(ahead) <= 6),
  quotes          jsonb check (quotes is null or (jsonb_typeof(quotes) = 'array' and jsonb_array_length(quotes) <= 4)),
  content_is_real boolean not null default false,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null
);
create trigger goal_content_touch before update on public.goal_content
  for each row execute function public.touch_updated_at();

alter table public.goal_content enable row level security;
create policy goal_content_read on public.goal_content for select using (true);
create policy goal_content_edit on public.goal_content for update
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.goal_content from anon, authenticated;
grant select on public.goal_content to anon, authenticated;
grant update on public.goal_content to authenticated;

insert into public.goal_content (key) values
  ('asset'), ('holiday'), ('emergency'), ('retrenchment'), ('education')
  on conflict (key) do nothing;
