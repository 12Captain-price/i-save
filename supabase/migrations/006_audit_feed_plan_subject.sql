-- =====================================================================
-- iSave migration 006: audit feed shows the member for "Plan chosen" rows
--
-- Migration 005 matched payment, ledger and profile audit rows to a member, but a plan
-- enrolment row is filed under the enrolment, so its "About" column was empty. This joins
-- plan_enrollments as well. The view keeps exactly the same columns, so nothing in the app
-- changes. Read-only: no tables and no data are touched.
-- =====================================================================

create or replace view public.audit_feed with (security_invoker = true) as
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
  left join public.plan_enrollments enr
         on a.entity = 'plan_enrollment' and enr.id::text = a.entity_id
  left join public.receipts r
         on (a.entity = 'payment' and r.payment_id = pay.id)
         or (a.entity = 'ledger_transaction' and r.ledger_id = lt.id)
  left join public.profiles sm
         on sm.id::text = coalesce(case when a.entity = 'profile' then a.entity_id end,
                                   pay.member_id::text,
                                   lt.member_id::text,
                                   enr.member_id::text);
