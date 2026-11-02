-- Tests for migration 009: published-only reads, admin-only writes, announcements sent once.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  fin   uuid := '00000000-0000-0000-0000-0000000000f1';
  m1 uuid := '00000000-0000-0000-0000-0000000000b1';
  m2 uuid := '00000000-0000-0000-0000-0000000000b2';
  m3 uuid := '00000000-0000-0000-0000-0000000000b3';
  v_id uuid; v_res jsonb; v_draft uuid;
begin
  perform t.as_owner();
  -- m1: email + WhatsApp; m2: email only; m3: pending (not active), must get nothing.
  update public.profiles set id_sighted_at = now(), status = 'active', email_opt_in = true,  whatsapp_opt_in = true  where id = m1;
  update public.profiles set id_sighted_at = now(), status = 'active', email_opt_in = true,  whatsapp_opt_in = false where id = m2;
  update public.profiles set status = 'pending', email_opt_in = true, whatsapp_opt_in = true  where id = m3;

  -- Seeded content is public.
  perform t.as_user(null);
  perform t.assert((select count(*) from public.site_pages) = 3, 'visitors can read the three seeded pages');
  perform t.assert((select count(*) from public.faqs) >= 20, 'visitors can read the seeded FAQs');

  -- Visitors and members cannot write.
  perform t.expect_error($q$update public.site_pages set body = 'x' where key = 'terms'$q$, '%permission denied%');
  perform t.as_user(m1);
  perform t.assert(
    (select count(*) from (select 1 from public.faqs limit 1) s) = 1, 'a member can read FAQs');
  perform t.as_owner();
  perform t.as_user(fin);
  -- Finance staff are not admins: writes are filtered by RLS.
  perform t.expect_error($q$insert into public.team_members (full_name, role_title) values ('A', 'B')$q$, '%row-level security%');
  perform t.as_owner();

  -- Admin edits a page and the change shows.
  perform t.as_user(admin);
  update public.site_pages set body = 'New text' where key = 'terms';
  perform t.assert((select body from public.site_pages where key = 'terms') = 'New text', 'admin can edit a page');
  update public.site_pages set published = false where key = 'privacy';
  perform t.as_user(null);
  perform t.assert((select count(*) from public.site_pages where key = 'privacy') = 0, 'an unpublished page is hidden from visitors');
  perform t.as_user(admin);
  perform t.assert((select count(*) from public.site_pages where key = 'privacy') = 1, 'but admins still see it');

  -- Drafts are hidden, published items are shown.
  insert into public.events (title, event_date, published) values ('Draft event', current_date, false);
  insert into public.events (title, event_date, published) values ('Public event', current_date, true) returning id into v_id;
  insert into public.event_images (event_id, path) values (v_id, 'events/a.jpg');
  perform t.as_user(null);
  perform t.assert((select count(*) from public.events) = 1, 'visitors see only published events');
  perform t.assert((select count(*) from public.event_images) = 1, 'and the pictures of published events');

  -- Announcements: draft is hidden; sending needs admin, a published row, and works once.
  perform t.as_user(admin);
  insert into public.announcements (title, body) values ('Office closed Friday', 'We are closed on Friday.') returning id into v_draft;
  perform t.expect_error(format('select public.send_announcement(%L)', v_draft), '%Publish the announcement%');
  update public.announcements set published = true where id = v_draft;
  perform t.assert((select published_at from public.announcements where id = v_draft) is not null, 'publishing stamps the date');

  perform t.as_user(fin);
  perform t.expect_error(format('select public.send_announcement(%L)', v_draft), '%Only administrators%');
  perform t.as_user(m1);
  perform t.expect_error(format('select public.send_announcement(%L)', v_draft), '%Only administrators%');

  perform t.as_user(admin);
  v_res := public.send_announcement(v_draft);
  perform t.as_owner();
  perform t.assert((v_res->>'email')::int = (select count(*) from public.profiles where status = 'active' and email_opt_in and email is not null), 'email goes to every opted-in active member');
  perform t.assert((v_res->>'whatsapp')::int = 1, 'WhatsApp goes only to opted-in active members (m1)');
  perform t.assert((select count(*) from public.notifications where event = 'announcement' and member_id = m3) = 0, 'pending members get nothing');
  perform t.assert((select count(*) from public.notifications where event = 'announcement' and member_id = m1 and channel = 'in_app') = 1, 'members get it in the app');
  perform t.assert((select count(*) from public.notifications where event = 'announcement' and channel = 'whatsapp' and status = 'queued') = 1, 'WhatsApp waits in the outbox');
  perform t.assert(exists (select 1 from public.audit_logs where action = 'announcement_sent' and entity_id = v_draft::text), 'sending is audited');

  perform t.as_user(admin);
  perform t.expect_error(format('select public.send_announcement(%L)', v_draft), '%already been sent%');
  perform t.expect_error(format($q$update public.announcements set title = 'Changed' where id = %L$q$, v_draft), '%already been sent%');
  perform t.expect_error(format($q$update public.announcements set sent_at = null where id = %L$q$, v_draft), '%cannot be edited%');

  -- A channel switched off is not queued.
  insert into public.announcements (title, body, published, send_whatsapp) values ('Email only', 'Body', true, false) returning id into v_id;
  v_res := public.send_announcement(v_id);
  perform t.assert((v_res->>'whatsapp')::int = 0, 'WhatsApp is skipped when switched off');

  -- Staff can mark WhatsApp rows as sent, members cannot.
  perform t.as_user(m1);
  perform t.expect_error($q$select public.mark_whatsapp_sent(array[gen_random_uuid()])$q$, '%Only staff%');
  perform t.as_user(fin);
  perform t.assert(public.mark_whatsapp_sent(array(select id from public.notifications where channel = 'whatsapp' and status = 'queued')) = 1, 'staff mark outbox rows sent');
  perform t.as_owner();
end $$;
