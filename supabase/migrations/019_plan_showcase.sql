-- 019: richer plan descriptions and the goal-based plan.
--
-- long_description  A fuller description written by an administrator. It is shown on the public
--                   Plans page under the plan, using the same simple formatting as the other
--                   site pages (## for a heading, a blank line between paragraphs).
-- is_goal_based     Marks the one plan that is shown as the large featured goal-based plan.
--                   Only one plan can be marked at a time.
--
-- Nothing here changes who can see a plan. The existing rules still apply: visitors only see
-- a plan that has an approved, live version.

alter table public.savings_plans
  add column long_description text
    check (long_description is null or length(long_description) <= 4000),
  add column is_goal_based boolean not null default false;

create unique index savings_plans_one_goal_based
  on public.savings_plans (is_goal_based) where is_goal_based;
