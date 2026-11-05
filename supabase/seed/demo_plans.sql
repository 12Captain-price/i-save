-- DEMO PLANS for the marketing site. Run once in the Supabase SQL Editor (paste the whole file).
--
-- Creates seven catchy, clearly illustrative savings plans, each live on the Plans page with a
-- theme (the click animation), and one Combo plan that bundles three goals. Safe to run twice:
-- a plan whose name already exists is skipped.
--
-- ALL AMOUNTS AND TERMS HERE ARE MADE UP for the demo phase (agreed with the manager). The Plans
-- page tells visitors that final amounts and terms are confirmed by their agent. Edit or replace
-- any plan under Staff > Plans. To remove a demo plan, retire its version there.
--
-- Needs migrations 019 and 021 to have been run first.

do $$
declare
  p    record;
  v_id uuid;
begin
  for p in
    select * from (values
      ('Dream Home Builder',
       'Lay the first brick on a stand, a house or a deposit. Small weekly steps, one big dream.',
       E'## Build it one brick at a time\n\nSet aside a small amount every week and watch your property goal take shape. Perfect for a stand, a deposit or the materials for your own home.',
       'asset', false, '{}'::text[], 10.00::numeric, null::numeric, null::numeric, 156::int),
      ('Holiday Getaway Club',
       'Your next trip, paid for before you pack.',
       E'## Travel without the worry\n\nSave a little each week and head off with the money already in place. Family trips, long weekends or the holiday you have been talking about for years.',
       'holiday', false, '{}'::text[], 5.00::numeric, null::numeric, null::numeric, 52::int),
      ('Rainy Day Shield',
       'A cushion for the things nobody plans for.',
       E'## Be ready for surprises\n\nRepairs, medical bills, sudden family needs. Build a cushion steadily so a surprise stays a small problem.',
       'emergency', false, '{}'::text[], 3.00::numeric, null::numeric, null::numeric, null::int),
      ('Job Safety Net',
       'Breathing room if work ever changes.',
       E'## Plan for the unexpected\n\nKeep saving while you work, so a change in income gives you time to find your next step without panic.',
       'retrenchment', false, '{}'::text[], 4.00::numeric, null::numeric, null::numeric, 104::int),
      ('School Fees Sorted',
       'Term after term, covered.',
       E'## Say goodbye to the fees rush\n\nSave all year for school, college or training costs, so the next term starts with the money already set aside.',
       'education', false, '{}'::text[], 8.00::numeric, null::numeric, null::numeric, 39::int),
      ('The Triple Goal Combo',
       'Save for more than one goal in one plan.',
       E'## One plan, three goals\n\nYour weekly contribution works towards a home, your education and an emergency cushion together. Choose an amount within the range that suits you.',
       'combo', true, array['Asset','Education','Emergency']::text[], null::numeric, 10.00::numeric, 50.00::numeric, 156::int),
      ('Flexi Saver',
       'Save what you can, when you can.',
       E'## Your pace\n\nPick any weekly amount in the range and keep going for as long as you like. No end date, no pressure.',
       'other', false, '{}'::text[], null::numeric, 2.00::numeric, 20.00::numeric, null::int)
    ) as t(name, descr, long_desc, theme, combo, goals, amount, min_a, max_a, weeks)
  loop
    continue when exists (select 1 from public.savings_plans where name = p.name);

    insert into public.savings_plans
      (name, description, long_description, theme, is_goal_based, combo_goals)
    values
      (p.name, p.descr, p.long_desc, p.theme, p.combo, p.goals)
    returning id into v_id;

    insert into public.savings_plan_versions
      (plan_id, version, status, contribution_amount, min_amount, max_amount,
       duration_weeks, terms_text, approved_at)
    values
      (v_id, 1, 'active', p.amount, p.min_a, p.max_a, p.weeks,
       'Illustrative plan for demonstration. Final amounts and terms are confirmed by your registration agent when you apply.',
       now());
  end loop;
end $$;

-- See what was created:
select p.name, p.theme, p.is_goal_based as combo, v.contribution_amount, v.min_amount, v.max_amount, v.duration_weeks
from public.savings_plans p
join public.savings_plan_versions v on v.plan_id = p.id and v.status = 'active'
order by p.created_at;
