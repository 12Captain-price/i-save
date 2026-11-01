-- =====================================================================
-- iSave migration 005: audit feed and ledger search (read only)
--
-- Two views, no new tables and no new write paths:
--   * audit_feed    : every audit row with WHO did it (name, not just an ID), who it was
--                     ABOUT, and the receipt number where there is one. Admins only,
--                     because the audit_logs table is admin only (policy audit_select).
--   * ledger_search : every ledger row with member, receipt numbers, who recorded it and
--                     whether it was later reversed. Any staff member (finance or admin),
--                     because ledger_transactions is readable by staff.
-- Both views use security_invoker, so the caller's own row-level security applies and a
-- member or a visitor gets nothing back.
-- =====================================================================

create view public.audit_feed with (security_invoker = true) as
select a.id,
       a.created_at,
       a.action,
       a.entity,
       a.entity_id,
       a.details,
       a.actor_id,
       case when a.actor_id is null then 'System'
            else coalesce(nullif(ap.full_name, ''), 'Unknown user') end as actor_name,
       ap.member_number                                                   as actor_number,
       sm.id                                                              as subject_member_id,
       sm.full_name                                                       as subject_name,
       sm.member_number                                                   as subject_number,
       coalesce(a.details ->> 'receipt_number', r.receipt_number)         as receipt_number
  from public.audit_logs a
  left join public.profiles ap on ap.id = a.actor_id
  left join public.payments pay
         on a.entity = 'payment' and pay.id::text = a.entity_id
  left join public.ledger_transactions lt
         on a.entity = 'ledger_transaction' and lt.id::text = a.entity_id
  left join public.receipts r
         on (a.entity = 'payment' and r.payment_id = pay.id)
         or (a.entity = 'ledger_transaction' and r.ledger_id = lt.id)
  left join public.profiles sm
         on sm.id::text = coalesce(case when a.entity = 'profile' then a.entity_id end,
                                   pay.member_id::text,
                                   lt.member_id::text);

create view public.ledger_search with (security_invoker = true) as
select l.id,
       l.reference,
       l.created_at,
       l.type,
       l.amount,
       l.currency,
       l.fee_delta,
       l.savings_delta,
       l.reason,
       l.member_id,
       m.member_number,
       m.full_name,
       l.created_by,
       cb.full_name                                           as created_by_name,
       coalesce(r.receipt_number, ro.receipt_number)          as receipt_number,
       coalesce(p.office_receipt_no, po.office_receipt_no)    as office_receipt_no,
       l.reverses_id,
       orig.reference                                         as reverses_reference,
       exists (select 1 from public.ledger_transactions x where x.reverses_id = l.id) as reversed
  from public.ledger_transactions l
  join public.profiles m on m.id = l.member_id
  left join public.profiles cb on cb.id = l.created_by
  left join public.receipts r  on r.ledger_id = l.id
  left join public.payments p  on p.id = l.payment_id
  left join public.ledger_transactions orig on orig.id = l.reverses_id
  left join public.receipts ro on ro.ledger_id = l.reverses_id
  left join public.payments po on po.id = orig.payment_id;

revoke all on public.audit_feed    from anon;
revoke all on public.ledger_search from anon;
grant select on public.audit_feed    to authenticated;
grant select on public.ledger_search to authenticated;

-- Search by date is by the day the money moved, so index the timestamps both views sort on.
create index if not exists audit_created_idx  on public.audit_logs (created_at desc);
create index if not exists ledger_created_idx on public.ledger_transactions (created_at desc);
