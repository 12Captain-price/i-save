-- Tests for migration 030: team contact details are public only when ticked and published.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  m1    uuid := '00000000-0000-0000-0000-0000000000b1';
  t1 uuid; t2 uuid;
begin
  perform t.as_owner();
  insert into public.team_members (full_name, role_title, published) values ('Shown Person', 'Director', true) returning id into t1;
  insert into public.team_members (full_name, role_title, published) values ('Hidden Person', 'Clerk', true) returning id into t2;

  perform t.as_user(admin);
  insert into public.team_contact_details (member_id, phone, email, show_on_contact)
    values (t1, '+263771234567', 'shown@example.com', true);
  insert into public.team_contact_details (member_id, phone, email, show_on_contact)
    values (t2, '+263772222222', 'hidden@example.com', false);
  perform t.assert((select count(*) from public.team_contact_details) = 2, 'admin sees every row');

  perform t.as_user(null);
  perform t.assert((select count(*) from public.team_contact_details) = 1, 'visitors see only ticked rows');
  perform t.assert((select phone from public.team_contact_details) = '+263771234567', 'the ticked row is the right one');

  perform t.as_user(m1);
  perform t.assert((select count(*) from public.team_contact_details) = 1, 'a member sees only ticked rows');
  perform t.expect_error(format($q$insert into public.team_contact_details (member_id, email, show_on_contact) values (%L, 'x@example.com', true)$q$, t2), '%row-level security%');

  -- Unpublishing the person hides their contact row from the public too.
  perform t.as_user(admin);
  update public.team_members set published = false where id = t1;
  perform t.as_user(null);
  perform t.assert((select count(*) from public.team_contact_details) = 0, 'an unpublished person has no public contact row');

  -- Bad data is refused.
  perform t.as_user(admin);
  perform t.expect_error($q$update public.team_contact_details set phone = '0771234567' where phone = '+263772222222'$q$, '%check%');
  perform t.expect_error($q$update public.team_contact_details set email = 'nope' where phone = '+263772222222'$q$, '%check%');
  perform t.expect_error($q$update public.team_contact_details set phone = null, email = null, show_on_contact = true where phone = '+263772222222'$q$, '%check%');

  -- Removing the person removes their contact row.
  perform t.as_owner();
  delete from public.team_members where id = t2;
  perform t.assert((select count(*) from public.team_contact_details where member_id = t2) = 0, 'contact row goes with the person');
end $$;
