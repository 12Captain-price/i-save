-- 018: traffic tracking. The site records three kinds of event: a page view, a click on an
-- "Apply to membership" link, and a click on an agent's registration button (the handoff).
-- Registrations finished on the agents' own site are NOT counted: the two systems are not
-- linked, so the agent click is the count.
--
-- Nothing personal is stored. A visitor is a random code kept in that browser, with no name,
-- email, phone number or IP address.
--
-- Visitors cannot read or write the table directly. They can only call record_traffic(),
-- which checks everything. Administrators read the figures through traffic_summary().

create table public.traffic_events (
  id          bigint generated always as identity primary key,
  event_type  text not null check (event_type in ('page_view', 'apply_click', 'agent_click')),
  path        text not null check (length(path) between 1 and 200),
  agent_id    uuid references public.agents(id) on delete set null,
  agent_name  text check (agent_name is null or length(agent_name) <= 120),
  visitor_id  text not null check (length(visitor_id) between 8 and 64),
  created_at  timestamptz not null default now()
);
create index traffic_events_time_idx on public.traffic_events (created_at);
create index traffic_events_visitor_idx on public.traffic_events (visitor_id, created_at);

alter table public.traffic_events enable row level security;
revoke all on public.traffic_events from anon, authenticated;
-- No policies on purpose: only the two functions below can touch this table.

-- ---------------------------------------------------------------------
-- Recording. Bad input is ignored quietly: counting must never break the site.
-- ---------------------------------------------------------------------
create or replace function public.record_traffic(
  p_type     text,
  p_path     text,
  p_agent_id uuid default null,
  p_visitor  text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_path       text := left(coalesce(nullif(trim(p_path), ''), '/'), 200);
  v_visitor    text := left(trim(coalesce(p_visitor, '')), 64);
  v_agent_id   uuid := null;
  v_agent_name text := null;
begin
  if p_type is null or p_type not in ('page_view', 'apply_click', 'agent_click') then
    return;
  end if;
  if length(v_visitor) < 8 then return; end if;
  if v_path !~ '^/' then return; end if;
  -- Admin and sign-in screens are never counted.
  if v_path ~ '^/(staff|login|forgot-password|reset-password)(/|$)' then return; end if;

  -- A person clicking around cannot make 30 events in a minute. A script can, so ignore it.
  if (select count(*) from public.traffic_events
       where visitor_id = v_visitor and created_at > now() - interval '1 minute') >= 30 then
    return;
  end if;

  if p_type = 'agent_click' then
    select a.id, a.name into v_agent_id, v_agent_name
      from public.agents a where a.id = p_agent_id and a.published;
    if v_agent_id is null then return; end if;
  end if;

  insert into public.traffic_events (event_type, path, agent_id, agent_name, visitor_id)
  values (p_type, v_path, v_agent_id, v_agent_name, v_visitor);
end $$;

revoke all on function public.record_traffic(text, text, uuid, text) from public;
grant execute on function public.record_traffic(text, text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Reading. Administrators only. Days are Zimbabwe days (Africa/Harare), both ends included.
-- ---------------------------------------------------------------------
create or replace function public.traffic_summary(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only administrators can see traffic.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Choose a date range of up to one year.' using errcode = '22023';
  end if;

  v_from := p_from::timestamp at time zone 'Africa/Harare';
  v_to   := (p_to + 1)::timestamp at time zone 'Africa/Harare';

  return jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'page_views',       count(*) filter (where event_type = 'page_view'),
        'visitors',         count(distinct visitor_id) filter (where event_type = 'page_view'),
        'apply_clicks',     count(*) filter (where event_type = 'apply_click'),
        'agent_clicks',     count(*) filter (where event_type = 'agent_click'),
        'apply_page_views', count(*) filter (where event_type = 'page_view' and path = '/apply')
      )
      from public.traffic_events
      where created_at >= v_from and created_at < v_to
    ),
    'pages', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.views desc, r.path)
      from (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from public.traffic_events
        where event_type = 'page_view' and created_at >= v_from and created_at < v_to
        group by path
        order by count(*) desc, path
        limit 100
      ) r
    ), '[]'::jsonb),
    'agents', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.clicks desc, r.name)
      from (
        -- Every current agent, even with no clicks yet.
        select a.id::text as agent_id, a.name, false as removed,
               count(e.id) as clicks, count(distinct e.visitor_id) as visitors
        from public.agents a
        left join public.traffic_events e
          on e.agent_id = a.id and e.event_type = 'agent_click'
         and e.created_at >= v_from and e.created_at < v_to
        group by a.id, a.name
        union all
        -- Agents that were removed after getting clicks.
        select null::text, coalesce(e.agent_name, 'Removed agent'), true,
               count(*), count(distinct e.visitor_id)
        from public.traffic_events e
        where e.event_type = 'agent_click' and e.agent_id is null
          and e.created_at >= v_from and e.created_at < v_to
        group by coalesce(e.agent_name, 'Removed agent')
      ) r
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.day)
      from (
        select to_char(g.day, 'YYYY-MM-DD') as day,
               count(e.id) filter (where e.event_type = 'page_view')   as views,
               count(e.id) filter (where e.event_type = 'apply_click') as apply_clicks,
               count(e.id) filter (where e.event_type = 'agent_click') as agent_clicks
        from generate_series(p_from, p_to, interval '1 day') as g(day)
        left join public.traffic_events e
          on (e.created_at at time zone 'Africa/Harare')::date = g.day::date
         and e.created_at >= v_from and e.created_at < v_to
        group by g.day
      ) d
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.traffic_summary(date, date) from public;
grant execute on function public.traffic_summary(date, date) to authenticated;
