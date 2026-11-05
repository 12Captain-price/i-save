-- 022: home page dashboard figures that admins can edit.
-- One row holds the headline numbers (members, agents and so on) and the month-by-month
-- bars for the graph. Anyone may read it (it is shown on the public home page); only admins
-- may change it. The row cannot be added to or deleted.
--
-- member_count  Members tile on the home page. Empty hides the tile.
-- agent_count   Registration agents tile. Empty means "count the published agents".
-- monthly       [{"month":"2026-11","savings":90000,"members":160}, ...]. A month that is not
--               listed uses the built-in demo value.
-- illustrative  true shows "Illustrative demo figures" on the home page; false shows
--               "Figures supplied by the office".

create table public.dashboard_figures (
  id            int primary key default 1 check (id = 1),
  member_count  int check (member_count is null or member_count between 0 and 100000000),
  agent_count   int check (agent_count is null or agent_count between 0 and 100000),
  active_savers int not null default 2460 check (active_savers between 0 and 100000000),
  goals_reached int not null default 479 check (goals_reached between 0 and 100000000),
  towns_reached int not null default 18 check (towns_reached between 0 and 100000),
  avg_saved     int not null default 142 check (avg_saved between 0 and 100000000),
  monthly       jsonb not null default '[]'::jsonb check (jsonb_typeof(monthly) = 'array'),
  illustrative  boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
create trigger dashboard_figures_touch before update on public.dashboard_figures
  for each row execute function public.touch_updated_at();

alter table public.dashboard_figures enable row level security;
create policy dashboard_figures_read on public.dashboard_figures for select using (true);
create policy dashboard_figures_edit on public.dashboard_figures for update
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.dashboard_figures from anon, authenticated;
grant select on public.dashboard_figures to anon, authenticated;
grant update on public.dashboard_figures to authenticated;

-- Start with the figures the site already shows.
insert into public.dashboard_figures (id, member_count) values (1, 3200)
  on conflict (id) do nothing;
