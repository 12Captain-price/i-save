-- 015: let people clear out notices that would otherwise pile up.
-- Members can delete their own in-app messages. Admins can throw away WhatsApp messages
-- that are waiting in the outbox. Money records (payments, receipts, the ledger, withdrawals)
-- and the audit log are not touched here and stay permanent.
-- The notifications table has no direct delete grant, so each cleanup goes through a function
-- that checks who is asking and which rows they may remove.

create or replace function public.delete_my_message(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in' using errcode = '42501';
  end if;
  delete from public.notifications
   where id = p_id and member_id = auth.uid() and channel = 'in_app';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.delete_my_message(uuid) from public, anon;
grant execute on function public.delete_my_message(uuid) to authenticated;

create or replace function public.delete_my_messages()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in' using errcode = '42501';
  end if;
  delete from public.notifications
   where member_id = auth.uid() and channel = 'in_app';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.delete_my_messages() from public, anon;
grant execute on function public.delete_my_messages() to authenticated;

-- Admins discard queued WhatsApp messages that should not be sent. Sent ones stay as a record.
create or replace function public.discard_whatsapp_outbox(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can do this' using errcode = '42501';
  end if;
  delete from public.notifications
   where id = any(p_ids) and channel = 'whatsapp' and status = 'queued';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.discard_whatsapp_outbox(uuid[]) from public, anon;
grant execute on function public.discard_whatsapp_outbox(uuid[]) to authenticated;
