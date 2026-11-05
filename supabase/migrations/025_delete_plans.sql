-- 025: admins can delete plans and draft versions.
--
-- A plan can be deleted only if no member has ever joined any of its versions. Members keep the
-- terms they accepted, so a plan with members is never deleted: stop new sign-ups on its live
-- version instead, which hides it from the website. A version can be deleted only while it is
-- still a draft, and never if it is the plan's only version (delete the plan instead).
--
-- Run once in the Supabase SQL editor.

create or replace function public.delete_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only administrators can delete plans.' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.plan_enrollments e
    join public.savings_plan_versions v on v.id = e.plan_version_id
    where v.plan_id = p_plan_id
  ) then
    raise exception 'Members have joined this plan, so it cannot be deleted. Use “Stop new sign-ups” on its live version to hide it from the website.'
      using errcode = '23503';
  end if;
  delete from public.savings_plan_versions where plan_id = p_plan_id;
  delete from public.savings_plans where id = p_plan_id;
end $$;

create or replace function public.delete_draft_version(p_version_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_plan   uuid;
  v_status public.plan_status;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only administrators can delete plan versions.' using errcode = '42501';
  end if;
  select plan_id, status into v_plan, v_status
    from public.savings_plan_versions where id = p_version_id;
  if v_plan is null then
    raise exception 'That version no longer exists.' using errcode = '22023';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only draft versions can be deleted. A version that has been live stays on record.'
      using errcode = '42501';
  end if;
  if (select count(*) from public.savings_plan_versions where plan_id = v_plan) <= 1 then
    raise exception 'This is the only version of the plan. Delete the whole plan instead.'
      using errcode = '22023';
  end if;
  delete from public.savings_plan_versions where id = p_version_id;
end $$;

revoke all on function public.delete_plan(uuid) from public;
revoke all on function public.delete_draft_version(uuid) from public;
grant execute on function public.delete_plan(uuid) to authenticated;
grant execute on function public.delete_draft_version(uuid) to authenticated;
