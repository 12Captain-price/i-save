-- Tests for migration 029: events get a publish date; announcement attachments follow publishing.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  m1 uuid := '00000000-0000-0000-0000-0000000000b1';
  v_ev uuid; v_draft_ev uuid; v_an uuid; v_draft_an uuid;
begin
  perform t.as_user(admin);
  insert into public.events (title, event_date, published) values ('Open day', current_date, true) returning id into v_ev;
  insert into public.events (title, event_date, published) values ('Hidden day', current_date, false) returning id into v_draft_ev;
  perform t.assert((select published_at from public.events where id = v_ev) is not null, 'a published event gets a publish date');
  perform t.assert((select published_at from public.events where id = v_draft_ev) is null, 'a draft event has no publish date');
  update public.events set published = true where id = v_draft_ev;
  perform t.assert((select published_at from public.events where id = v_draft_ev) is not null, 'publishing a draft stamps the date');

  insert into public.announcements (title, body, published) values ('With flier', 'Body', true) returning id into v_an;
  insert into public.announcements (title, body, published) values ('Draft notice', 'Body', false) returning id into v_draft_an;
  insert into public.announcement_files (announcement_id, path, media_type, file_name) values (v_an, 'announcements/a.pdf', 'pdf', 'a.pdf');
  insert into public.announcement_files (announcement_id, path) values (v_draft_an, 'announcements/b.jpg');

  perform t.as_user(null);
  perform t.assert((select count(*) from public.announcement_files where announcement_id = v_an) = 1, 'visitors see files of a published announcement');
  perform t.assert((select count(*) from public.announcement_files where announcement_id = v_draft_an) = 0, 'visitors do not see files of a draft');
  perform t.expect_error(format($q$insert into public.announcement_files (announcement_id, path) values (%L, 'x.jpg')$q$, v_an), '%permission denied%');

  perform t.as_user(m1);
  perform t.expect_error(format($q$insert into public.announcement_files (announcement_id, path) values (%L, 'x.jpg')$q$, v_an), '%row-level security%');

  perform t.as_user(admin);
  perform t.assert((select count(*) from public.announcement_files where announcement_id = v_draft_an) = 1, 'admin sees files of a draft');
  delete from public.announcements where id = v_an;
  perform t.assert((select count(*) from public.announcement_files where announcement_id = v_an) = 0, 'deleting an announcement removes its files');
  perform t.as_owner();
end $$;
