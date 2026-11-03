-- Tests for migration 015: members clear their own messages, admins clear the WhatsApp outbox.
-- Uses member b2 and b3 and the admin a1 / finance f1 users from earlier fixtures.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  fin   uuid := '00000000-0000-0000-0000-0000000000f1';
  m2    uuid := '00000000-0000-0000-0000-0000000000b2';
  m3    uuid := '00000000-0000-0000-0000-0000000000b3';
  one   uuid;
  n     int;
begin
  perform t.as_owner();
  delete from public.notifications where member_id in (m2, m3);
  insert into public.notifications (member_id, channel, event, subject, body, status) values
    (m2, 'in_app', 'announcement', 'A', 'one',   'delivered'),
    (m2, 'in_app', 'announcement', 'B', 'two',   'delivered'),
    (m3, 'in_app', 'announcement', 'C', 'three', 'delivered');
  insert into public.notifications (member_id, channel, event, subject, body, status) values
    (m2, 'whatsapp', 'announcement', 'W1', 'queued one', 'queued'),
    (m2, 'whatsapp', 'announcement', 'W2', 'sent one',   'sent');

  -- A member removes one of their own messages, and cannot remove someone else's.
  perform t.as_owner();
  select id into one from public.notifications where member_id = m3 and channel = 'in_app';
  perform t.as_user(m2);
  select public.delete_my_message(one) into n;
  perform t.assert(n = 0, 'a member cannot delete another member''s message');
  select id into one from public.notifications where member_id = m2 and subject = 'A';
  select public.delete_my_message(one) into n;
  perform t.assert(n = 1, 'a member can delete their own message');

  -- Clearing all removes only the member's own in-app messages.
  select public.delete_my_messages() into n;
  perform t.assert(n = 1, 'clear all removes the remaining in-app message');
  perform t.as_owner();
  perform t.assert(
    (select count(*) from public.notifications where member_id = m3 and channel = 'in_app') = 1,
    'another member''s messages are untouched');
  perform t.assert(
    (select count(*) from public.notifications where member_id = m2 and channel = 'whatsapp') = 2,
    'a member clearing messages does not touch WhatsApp rows');

  -- Visitors who are not signed in cannot use the cleanup functions.
  perform t.as_user(null);
  perform t.expect_error($q$select public.delete_my_messages()$q$, '%permission denied%');

  -- Finance staff are not admins and cannot discard outbox messages.
  perform t.as_user(fin);
  perform t.expect_error(
    $q$select public.discard_whatsapp_outbox(array[gen_random_uuid()])$q$, '%Only administrators%');

  -- An admin discards only queued WhatsApp messages; sent ones stay as a record.
  perform t.as_user(admin);
  select public.discard_whatsapp_outbox(array(select id from public.notifications where member_id = m2 and channel = 'whatsapp')) into n;
  perform t.assert(n = 1, 'only the queued WhatsApp message is discarded');
  perform t.as_owner();
  perform t.assert(
    (select count(*) from public.notifications where member_id = m2 and channel = 'whatsapp' and status = 'sent') = 1,
    'a sent WhatsApp message is kept');
end $$;
