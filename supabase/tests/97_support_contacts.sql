-- Tests for migration 013: only signed-in people read contacts, only admins write them.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  fin   uuid := '00000000-0000-0000-0000-0000000000f1';
  m1    uuid := '00000000-0000-0000-0000-0000000000b1';
  n     int;
begin
  perform t.as_owner();
  insert into public.support_contacts (full_name, role_title, whatsapp_phone, active)
    values ('Visible Vee', 'Cashier', '+263771234567', true),
           ('Hidden Hal',  'Cashier', '+263771234568', false);

  -- Visitors who are not signed in see nothing and cannot write.
  perform t.as_user(null);
  perform t.expect_error($q$select count(*) from public.support_contacts$q$, '%permission denied%');

  -- A member sees active contacts only, and cannot write.
  perform t.as_user(m1);
  perform t.assert((select count(*) from public.support_contacts) = 1, 'a member sees only active contacts');
  perform t.assert(
    (select count(*) from public.support_contacts where whatsapp_phone is not null) = 1, 'the number is readable by a member');
  update public.support_contacts set role_title = 'x';
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'a member cannot change a contact');
  perform t.expect_error($q$insert into public.support_contacts (full_name, role_title, whatsapp_phone) values ('A','B','+263771234569')$q$, '%row-level security%');

  -- Finance staff are not admins: they read active contacts but cannot write.
  perform t.as_user(fin);
  perform t.expect_error($q$insert into public.support_contacts (full_name, role_title, whatsapp_phone) values ('A','B','+263771234569')$q$, '%row-level security%');

  -- Admins see everything and can write.
  perform t.as_user(admin);
  perform t.assert((select count(*) from public.support_contacts) = 2, 'an admin sees hidden contacts too');
  insert into public.support_contacts (full_name, role_title, whatsapp_phone) values ('New Nia', 'Teller', '+263771234570');
  perform t.assert((select count(*) from public.support_contacts) = 3, 'an admin can add a contact');

  -- The database refuses numbers that are not in international format.
  perform t.expect_error($q$insert into public.support_contacts (full_name, role_title, whatsapp_phone) values ('Bad','Bad','0771234567')$q$, '%check constraint%');
  perform t.as_owner();
end $$;
