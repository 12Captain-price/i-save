-- 017: registration agents. Each agent has a name and a registration link; the public Apply
-- page shows one button per published agent. Admins manage the list from Staff > Agents, so
-- adding or changing an agent never needs a code change.

create table public.agents (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) between 1 and 120),
  registration_url text not null check (registration_url ~* '^https://[^\s]+$' and length(registration_url) <= 2000),
  note             text check (note is null or length(note) <= 200),
  sort_order       int  not null default 100,
  published        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger agents_touch before update on public.agents
  for each row execute function public.touch_updated_at();
create index agents_order_idx on public.agents (sort_order, name);

alter table public.agents enable row level security;

-- Visitors see published agents only; administrators see and change everything.
create policy agents_read on public.agents for select
  using (published or public.is_admin());
create policy agents_manage on public.agents for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.agents from anon, authenticated;
grant select on public.agents to anon, authenticated;
grant insert, update, delete on public.agents to authenticated;

-- Placeholder agents so the Apply page has something to show. Replace the names and links
-- from Staff > Agents (the admin screen flags any link that still points at example.com).
insert into public.agents (name, registration_url, note, sort_order) values
  ('Agent 1 (placeholder)', 'https://example.com/register/agent-1', null, 10),
  ('Agent 2 (placeholder)', 'https://example.com/register/agent-2', null, 20),
  ('Agent 3 (placeholder)', 'https://example.com/register/agent-3', null, 30);
