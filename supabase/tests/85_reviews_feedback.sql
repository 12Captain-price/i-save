-- Tests for migration 026: reviews need approval; feedback is private to staff and the sender.

do $$
declare
  admin uuid := '00000000-0000-0000-0000-0000000000a1';
  fin   uuid := '00000000-0000-0000-0000-0000000000f1';
  m1    uuid := '00000000-0000-0000-0000-0000000000b1';
  rid   uuid;
  fid   uuid;
  n     int;
begin
  perform t.as_owner();

  -- A member can write a review, but it always starts pending, even if they ask for approved.
  perform t.as_user(m1);
  insert into public.reviews (author_name, body, status, submitted_by)
    values ('Member Mo', 'Saving here has been simple and friendly.', 'approved', m1)
    returning id into rid;
  perform t.assert((select status from public.reviews where id = rid) = 'pending', 'a member review is pending even if they ask for approved');

  -- Visitors see nothing until it is approved.
  perform t.as_user(null);
  perform t.assert((select count(*) from public.reviews) = 0, 'a visitor sees no pending review');

  -- A member cannot approve their own review.
  perform t.as_user(m1);
  update public.reviews set status = 'approved' where id = rid;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'a member cannot approve a review');

  -- Staff approve it; the approver and time are recorded; visitors now see it.
  perform t.as_user(fin);
  update public.reviews set status = 'approved' where id = rid;
  perform t.assert((select approved_by from public.reviews where id = rid) = fin, 'approver recorded');
  perform t.assert((select approved_at from public.reviews where id = rid) is not null, 'approval time recorded');
  perform t.as_user(null);
  perform t.assert((select count(*) from public.reviews) = 1, 'a visitor sees the approved review');

  -- Taking it down clears the approval.
  perform t.as_user(admin);
  update public.reviews set status = 'rejected' where id = rid;
  perform t.assert((select approved_at from public.reviews where id = rid) is null, 'rejecting clears approval');
  perform t.as_user(null);
  perform t.assert((select count(*) from public.reviews) = 0, 'a rejected review is hidden');

  -- Staff can add a review of their own and delete one.
  perform t.as_user(fin);
  insert into public.reviews (author_name, body, status)
    values ('Staff Sam', 'Entered by the office on behalf of a member.', 'approved');
  delete from public.reviews where id = rid;
  get diagnostics n = row_count;
  perform t.assert(n = 1, 'staff can delete a review');

  -- Feedback: a member sends it, staff read it, other members do not.
  perform t.as_user(m1);
  insert into public.feedback (kind, subject, message)
    values ('request', 'Weekend office hours', 'Could the office open on Saturday mornings please?')
    returning id into fid;
  perform t.assert((select count(*) from public.feedback) = 1, 'a member sees their own message');
  perform t.assert((select status from public.feedback where id = fid) = 'new', 'new message starts as new');
  update public.feedback set status = 'resolved' where id = fid;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'a member cannot change the status');

  perform t.as_user(fin);
  perform t.assert((select count(*) from public.feedback where status = 'new') = 1, 'staff see the new message');
  update public.feedback set status = 'seen', staff_note = 'Asked the manager' where id = fid;
  perform t.assert((select handled_by from public.feedback where id = fid) = fin, 'handler recorded');
  perform t.expect_error($q$update public.feedback set message = 'changed' where true$q$, '%permission denied%');
  delete from public.feedback where id = fid;
  get diagnostics n = row_count;
  perform t.assert(n = 0, 'finance staff cannot delete feedback');

  perform t.as_user(admin);
  delete from public.feedback where id = fid;
  get diagnostics n = row_count;
  perform t.assert(n = 1, 'an admin can delete feedback');

  -- Migration 027: visitors with no account can send a review (pending) and feedback (with contact).
  perform t.as_user(null);
  insert into public.reviews (author_name, body, status, submitted_by)
    values ('Visitor Vee', 'Friendly office and clear explanations.', 'approved', m1);
  perform t.as_owner();
  perform t.assert((select status from public.reviews where author_name = 'Visitor Vee') = 'pending', 'a visitor review is pending');
  perform t.assert((select submitted_by from public.reviews where author_name = 'Visitor Vee') is null, 'a visitor review has no account attached');
  perform t.as_user(null);
  perform t.assert((select count(*) from public.reviews where author_name = 'Visitor Vee') = 0, 'visitors cannot see a pending review');

  insert into public.feedback (kind, subject, message, sender_name, sender_phone)
    values ('idea', 'Text reminders', 'A text reminder before the due date would help.', 'Visitor Vee', '+263 78 000 0000');
  perform t.expect_error($q$insert into public.feedback (subject, message, sender_name) values ('No contact', 'There is no way to reply to this one.', 'Vee')$q$, '%phone number or an email%');
  perform t.expect_error($q$insert into public.feedback (subject, message, sender_phone) values ('No name', 'There is no name on this one at all.', '+263780000000')$q$, '%your name%');
  perform t.assert((select count(*) from public.feedback) = 0, 'a visitor cannot read the inbox');

  perform t.as_user(fin);
  perform t.assert((select count(*) from public.feedback where sender_name = 'Visitor Vee' and user_id is null) = 1, 'staff see the visitor message');

  perform t.as_owner();
end $$;
