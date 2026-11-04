-- Tests for migration 016: everyone reads the office details, only admins change them.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  fin   uuid := '00000000-0000-0000-0000-0000000000f1';
  m1    uuid := '00000000-0000-0000-0000-0000000000b1';
  n     int;
begin
  perform t.as_user(null);
  perform t.assert((select count(*) from public.office_contact) = 1, 'a visitor can read the office details');
  update public.office_contact set hours = 'x';
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'a visitor cannot change them');

  perform t.as_user(m1);
  update public.office_contact set hours = 'x';
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'a member cannot change them');

  perform t.as_user(fin);
  update public.office_contact set hours = 'x';
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'finance staff who are not admins cannot change them');

  perform t.as_user(admin);
  update public.office_contact set hours = 'Mon to Fri, 8am to 4pm';
  get diagnostics n = row_count;
  perform t.assert(n = 1, 'an admin can change them');
  perform t.expect_error($q$update public.office_contact set whatsapp = '0786639536'$q$, '%check constraint%');
  perform t.expect_error($q$update public.office_contact set email = 'not an email'$q$, '%check constraint%');
  perform t.expect_error($q$insert into public.office_contact (id) values (2)$q$, '%permission denied%');
  perform t.expect_error($q$delete from public.office_contact$q$, '%permission denied%');
  perform t.as_owner();
end $$;
