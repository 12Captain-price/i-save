-- Test helpers and fixed test users. Local test database only.
create schema if not exists t;
grant usage on schema t to anon, authenticated, service_role;

-- Act as a logged-in user (id) or, with null, as an anonymous visitor.
create or replace function t.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true);
  if p_id is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;

-- Go back to the database owner (the SQL editor / service role equivalent).
create or replace function t.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function t.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'TEST FAILED: %', p_msg; end if;
end $$;

-- Run a statement that MUST fail with a message matching p_pattern (ILIKE).
create or replace function t.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike p_pattern then return; end if;
    raise exception 'TEST FAILED: wrong error for [%]. Wanted like "%", got "%"', p_sql, p_pattern, sqlerrm;
  end;
  raise exception 'TEST FAILED: expected an error for [%] but it succeeded', p_sql;
end $$;

grant execute on all functions in schema t to anon, authenticated, service_role;

-- Fixed users. Passwords do not matter; the stub has no login.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin1@test.local',   '{"full_name":"Admin One","phone":"+263770000001"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'finance1@test.local', '{"full_name":"Finance One","phone":"+263770000002"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'both1@test.local',    '{"full_name":"Finance And Admin","phone":"+263770000003"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'member1@test.local',  '{"full_name":"Member One","phone":"+263771000001"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'member2@test.local',  '{"full_name":"Member Two","phone":"+263771000002"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'member3@test.local',  '{"full_name":"Member Three","phone":"+263771000003"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'member4@test.local',  '{"full_name":"Member Four","phone":"+263771000004"}');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000f1', 'finance'),
  ('00000000-0000-0000-0000-0000000000f2', 'finance'),
  ('00000000-0000-0000-0000-0000000000f2', 'admin');
