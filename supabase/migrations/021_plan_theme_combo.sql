-- 021: plan theme (picks the click animation) and combo goals.
--
-- theme        Which short animation plays when a visitor clicks the plan card.
-- combo_goals  Goal names shown as small chips on a combo plan, for example
--              {Asset, Education, Emergency}. Used only for display.
-- is_goal_based (migration 019) now means "show the gold Combo ribbon". More than one plan can
-- carry it, so the one-plan-only index is dropped.

alter table public.savings_plans
  add column theme text not null default 'other'
    check (theme in ('holiday','asset','emergency','retrenchment','education','combo','other')),
  add column combo_goals text[] not null default '{}'
    check (cardinality(combo_goals) <= 6);

drop index if exists public.savings_plans_one_goal_based;
