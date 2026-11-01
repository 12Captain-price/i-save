# iSave

Member savings web application for the organisation. Members pay a one-time registration fee and a monthly subscription, choose a savings plan, and contribute weekly. Staff record and verify payments in the office. Every money event is kept in an append-only ledger.

**Status:** prototype build against Requirements Specification v1.2 (15 October 2026). It is not cleared to hold real members' money. See "Launch gates" below.

---

## 1. Confirmed decisions

| Topic | Decision |
| --- | --- |
| Registration fee | US$20, one-time. Recorded as a fee, never as savings. |
| Monthly subscription | US$5 per month. Recorded as a fee, never as savings. Billing start, due day, grace and overdue rules are not decided. |
| Savings cadence | Weekly only at launch. The schema supports other schedules, but they stay hidden. |
| Savings plans | The five categories: Asset, Holiday, Emergency, Retrenchment, Education. Admins can add more. Plans stay as drafts until the owner approves amounts and terms. No amount is ever invented or hard-coded. |
| How money arrives | In the office. Staff record the payment and confirm it in one step. The same person records and verifies. |
| Activation | A confirmed registration fee activates the account. No separate approval step. |
| Currency | USD only for now. ZiG is to be discussed with the owner. Every money table carries a currency column. |
| Registration | Two routes: members apply online, and staff register applicants in the office. |
| Email | Required for every member (login, password link, reminders). Members without one get help creating one at registration. |
| WhatsApp | Notification channel only, never login. Members opt in separately. Click-to-chat buttons first, automatic WhatsApp Business messages later. |
| Identity | Collect the national ID number. Staff look at the physical ID in the office and tick "ID sighted". No ID document uploads for now. |
| Withdrawals | Disabled. The screen reads "Policy pending approval". |
| Interest, bonuses, returns | Not offered, calculated or advertised. |
| Payments | Office payments at launch. EcoCash is integrated later by another developer behind a provider interface (see section 8). |
| Hosting | Git repository, deployed to Cloudflare as usual. Supabase for database and auth. |

---

## 2. Stack

- **Front end:** React, TypeScript, TanStack (Router, Query, Form, Table), Tailwind CSS, shadcn/ui, Zod
- **Database and auth:** Supabase (Postgres, Row Level Security, Supabase Auth)
- **Server-side tasks:** Cloudflare Workers (staff-assisted registration, notification sending, later payment webhooks)
- **Email:** Resend (or Supabase SMTP for basics)
- **Money handling:** `numeric(14,2)` in Postgres, `decimal.js` or integer cents in the browser. Never JavaScript floats.
- **Testing:** Vitest for logic, Playwright for key flows, SQL tests for ledger rules
- **Monitoring:** Sentry, Supabase logs, point-in-time recovery enabled in production

---

## 3. Architecture

```
Browser (React)
   |  anon key + user JWT
   v
Supabase  ------------------------------------------------------------
   Auth          Postgres: tables + RLS + functions (the rules live here)
                 - create_payment, enroll_in_plan
                 - confirm_payment, fail_payment, reverse_ledger_transaction
                 - record_office_payment (migration 002)
   ^
   |  service role key (Worker only, never in the browser)
Cloudflare Worker
   - staff-assisted registration (creates the auth user, sends set-password link)
   - notification sender (reads queued rows, sends email / WhatsApp)
   - later: payment provider webhooks (EcoCash)
```

**Where the rules live.** The money rules are in the database, not in the React code, so no screen, bug or future developer can bypass them:

- Clients cannot insert or update payments, ledger, audit, enrolments or notifications. Only the functions can.
- `confirm_payment` is the only way a payment reaches the ledger. It is idempotent, checks the provider amount, and refuses to let a staff member confirm their own payment.
- The ledger and audit log cannot be updated, deleted or truncated. Mistakes are fixed with a linked reversal that needs a reason.
- Plans cannot go active without an approved amount, and an active plan's terms cannot be edited. Changes need a new version.
- Fees and savings are separate columns (`fee_delta`, `savings_delta`). A fee can never raise the savings balance.

---

## 4. Database

**Migration 001 (done, tested on local Postgres 16):** `001_isave_schema.sql`

Tables: `profiles`, `user_roles`, `system_settings`, `savings_plans`, `savings_plan_versions`, `plan_enrollments`, `due_items`, `subscription_invoices`, `payments`, `payment_events`, `ledger_transactions`, `audit_logs`, `notifications`, `notification_templates`, `withdrawal_requests`.

Views: `member_balances`, `payment_verification_queue`.

**Migration 002 (done, tested on local Postgres 16):** `002_office_payments.sql`

- `record_office_payment(member, purpose, method, receipt_no, idempotency_key, ...)`: staff take cash or bank money and confirm it in one step, through the same `confirm_payment()` as every other path. Paper receipt numbers can only be used once.
- Receipts: one numbered receipt (`RCT-00000001`) per confirmed payment, append-only, plus the `member_receipts` view (reversed receipts stay on record and show as reversed).
- Profile fields: `registered_via`, `category_interest`, `age_confirmed_at`, `terms_accepted_at`, `id_sighted_by`, `id_sighted_at`. Members cannot edit the verification fields.
- National ID is kept in a locked table (`member_identity`), not on the profile. Staff read it through `get_member_national_id()`, and every look is audit-logged. The number itself is never written to the audit log.
- `mark_id_sighted()`: staff record the ID number from the physical document. An account cannot go from pending to active until this is done (setting `require_id_sighted_before_activation`).
- One person, one account: unique phone number and unique national ID.
- `enabled_currencies` setting (USD only), enforced on every new payment.
- `staff_daily_report` view (Zimbabwe calendar day) and `sign_off_daily_report()`: an admin signs off another staff member's day. Nobody can sign off their own.

Tests: `supabase/tests/` (run with `run_local.sh` against a throwaway local Postgres, never against Supabase).

---

## 5. Roles and screens

Roles: `member`, `finance` (the office staff member who records and verifies), `admin`, `super_admin`. One person can hold `finance` and `admin`.

**Public:** Home, How it works, Savings plans (from the database), Fees (from settings), FAQs, Contact, Terms, Privacy, Risk and withdrawal disclosure, Apply online.

**Member:** Dashboard (savings and fees shown separately), plan catalogue and comparison, plan selection with terms acknowledgement, contribution schedule, payment history and receipts, subscription status, notifications, profile and security, help, withdrawals (disabled).

**Staff (finance):** Member search, register an applicant in the office, record an office payment (registration, subscription or contribution), mark "ID sighted", payment history, daily summary.

**Admin:** Plans (add, version, approve, activate), members, transaction ledger search, reversals, audit log, system settings, staff daily report.

---

## 6. Build plan (about 2 days)

Estimates are working hours. Total is about 20 hours with little spare, so the cut list in 6.3 matters.

### 6.1 Day 1: foundation, public site, member side (about 9h)

| # | Task | Time |
| --- | --- | --- |
| 1 | Create Supabase project, run migration 001, make first super admin, set auth options | 0.5h |
| 2 | Write and test migration 002 (office payments, receipts, profile fields, phone unique, currencies) | 1.5h |
| 3 | Scaffold app: Vite or TanStack Start, Tailwind, shadcn, Supabase client, auth provider, route guards, role-aware layout. Port design tokens and logo from the old project | 1h |
| 4 | Port public pages: Home, How it works, Plans and Fees (read from the database), FAQs, Contact, Terms and Privacy placeholders, disclosures | 2.5h |
| 5 | Online application, login, password reset, pending-account screen showing the US$20 fee | 2h |
| 6 | Member dashboard: balances (fees apart from savings), history, receipts, notifications | 1.5h |

### 6.2 Day 2: office side, plans, contributions, deploy (about 10h)

| # | Task | Time |
| --- | --- | --- |
| 7 | Staff: register applicant (Worker endpoint plus page), member search, record office payment, ID sighted | 2h |
| 8 | Member plan selection with terms acknowledgement. Admin: add, edit, version and activate plans | 1.5h |
| 9 | Contributions: due list, staff record a contribution, member sees it confirmed, next due date appears | 1.5h |
| 10 | Admin: ledger search, reversals, audit log view, staff daily report | 1h |
| 11 | Notifications: Worker sends queued email via Resend. WhatsApp click-to-chat buttons | 1h |
| 12 | Disabled withdrawal screen, subscription status screen | 0.5h |
| 13 | Test the money rules, fix, deploy through git to Cloudflare, set environment variables, smoke test | 2h |
| 14 | Buffer | 0.5h |

### 6.3 If time runs short, cut in this order

1. Mock EcoCash adapter and developer panel (not needed for the office launch path)
2. Admin audit log screen (the data is still recorded)
3. Staff daily report screen
4. WhatsApp buttons
5. Notification emails (in-app notifications still work)

Never cut: the ledger rules, row-level security, office payment recording, receipts, the audit log, or the disabled withdrawal state.

### 6.4 Reuse from the old project

Port: the public pages and copy, design tokens, logo, the portal screen map, the five savings categories, contact details. Leave behind: the Python backend, Docker setup, Lovable packages, campaigns, content management, document scanning, support chat, backup tooling.

---

## 7. Notifications

- Every notification is a row in `notifications`. In-app is always created. Email is created if the member allows it. WhatsApp is created only if the member has opted in.
- A Worker sends queued rows and records the result, with retries.
- Wording must never imply pending money is confirmed. "Payment confirmed" is only sent once the payment is confirmed.
- WhatsApp stage 1: click-to-chat buttons (`wa.me` links) for "Chat with us" and a staff "Remind on WhatsApp" prefilled message. Stage 2: WhatsApp Business Cloud API with pre-approved templates. The owner must start the Meta business verification early, as it can take days to weeks.
- Phone numbers are stored in international format (+263...) so the links work.

---

## 8. EcoCash hand-over (for the integrating developer)

EcoCash is added after the system is complete. It plugs in behind a `PaymentProvider` interface, and only one adapter file changes.

**Adapter must provide:**

1. `initiate(payment)`: call the provider with amount, member number and our internal reference. Return the provider reference and status (`pending`).
2. `handleCallback(request)`: verify the signature, map the result to our status, then call `confirm_payment` or `fail_payment`.
3. `checkStatus(providerRef)`: polling fallback for callbacks that never arrive.

**Rules:**

- The adapter never writes to ledger tables. It only calls `confirm_payment` and `fail_payment`.
- Always pass the provider's reported amount to `confirm_payment`. A mismatch is refused and flagged for finance.
- Store every raw callback in `payment_events` (unique on provider plus event id) so replays are rejected.
- Use the service role key only inside the Worker.
- Run against the mock until the adapter passes the checklist below, then switch `payment_mode` from `manual`.

**Must pass before going live:** duplicate callback, late callback, failed payment, wrong amount, callback for an unknown reference, invalid signature.

**Open choice for the owner:** an aggregator such as Paynow (one integration, usually faster to approve) or EcoCash's own merchant API (can be cheaper per transaction). Merchant onboarding often takes longer than the code.

---

## 9. Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Front end | Public |
| `VITE_SUPABASE_ANON_KEY` | Front end | Public (publishable) key only |
| `SUPABASE_URL` | Worker | |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker only | Never in the front end or the repo |
| `RESEND_API_KEY` | Worker | Email sending |
| `EMAIL_FROM` | Worker | Sender address on a domain the owner controls |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Worker | Stage 2 only |
| `PAYMENT_WEBHOOK_SECRET` | Worker | When EcoCash is integrated |

No live credentials go in the repository. Use Cloudflare secrets.

---

## 10. Setup

1. Create a new Supabase project.
2. In the SQL editor, run `001_isave_schema.sql`, then `002` once it exists.
3. Under Authentication, Email: decide on email confirmation (leave it on for production).
4. Sign up once in the app, then promote yourself:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'super_admin' from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
5. Set environment variables, push to git, deploy to Cloudflare.
6. Turn on point-in-time recovery before any real use.

When signing up from the app, pass the name and phone in international format:

```ts
supabase.auth.signUp({
  email, password,
  options: { data: { full_name: "Full Name", phone: "+263771234567" } }
})
```

---

## 11. Acceptance checklist

From Section 16 of the specification:

- [ ] A member can register, and the US$20 registration fee is recorded apart from savings
- [ ] The US$5 subscription is shown and recorded apart from savings
- [ ] A member can compare and select an active, approved plan, and the exact version is kept
- [ ] No contribution amount is invented; only owner-approved amounts are offered
- [ ] Only weekly schedules are offered
- [ ] A pending, failed or rejected payment never raises confirmed savings
- [ ] A duplicate confirmation cannot credit twice
- [ ] Corrections are linked reversals; posted records are never deleted
- [ ] A member cannot see another member's data; admin actions are audited
- [ ] Withdrawals stay disabled until a policy is approved
- [ ] Reports tie back to the ledger and keep fees apart from savings
- [ ] Tests cover normal, duplicate, failed, reversed, unauthorised and edge cases

Migration 001 has been tested locally for the ledger, status, access and append-only rules. It still needs a first run on a real Supabase project.

---

## 12. Open decisions for the owner

Send as one numbered list so they can answer quickly.

1. Contribution amount for each plan (and any minimum or maximum), in USD
2. Withdrawal policy (eligibility, timing, limits, fees, approvals, payout method)
3. Whether any interest, bonus or return is offered (default: none)
4. Subscription billing start, due day, grace period, and what happens when it is overdue
5. Whether ZiG is accepted, and for which fees
6. Minimum age and any other eligibility rule
7. Missed-payment, pause, plan-change and early-exit rules
8. Whether the owner accepts that one staff member both records and verifies a payment, with the daily per-staff report as the control
9. Sender email domain, WhatsApp business number, and website domain
10. Payment provider choice for later (aggregator or direct EcoCash) and who integrates it
11. Data privacy notice, retention period, and final Terms
12. Legal and regulatory clearance (see below)
13. Full legal name and registration details of the entity that operates iSave (for example ZPYF, and whether it is a trust, company or other). Used on Terms, Privacy, receipts and email footers
14. Confirmation that ZPYF (Zimbabwe Progressive Youth Foundation) approves its name and logo being shown on the public site

### 12.1 Proposed defaults (for the owner to approve or change)

These are proposals, not decisions, and they are business-rule suggestions, not legal advice. The owner can reply "approved" or change individual lines. Anything touching money held for members must be checked by a Zimbabwean lawyer (see section 13).

| # | Topic | Proposed default |
|---|-------|------------------|
| 1 | Plan amounts | Three weekly plans, marked DRAFT: $5, $10 and $20. Minimum $5, maximum $50 per week. Plans stay inactive until the owner approves real amounts. |
| 2 | Withdrawals | Screen stays disabled ("Policy pending approval"). Proposed policy: withdraw only at plan maturity, minimum term 12 weeks. Admin approves each request. Payout only to an EcoCash number registered in the member's own name, within 3 business days. Any fee is shown before the member confirms. |
| 3 | Interest or returns | None. Savings are returned in full, less any disclosed withdrawal fee. No wording anywhere may promise returns. |
| 4 | Subscription billing | Monthly, due on the 1st, starting the month after registration. 7-day grace period, then the account shows "overdue" and reminders go out. Overdue blocks new plan enrolment and withdrawals until cleared. Fees are never taken from savings automatically. |
| 5 | ZiG | USD only at launch. ZiG is a later phase (needs exchange-rate rules and a currency column in the ledger). |
| 6 | Eligibility | 18 or older, national ID sighted by staff, one account per ID number and per phone number. |
| 7 | Missed payment, pause, plan change, early exit | Missed payment: 7-day grace and reminders, no penalty fee at launch, savings untouched. Pause: admin approval, up to 4 weeks. Plan change: only at cycle end, new plan version recorded. Early exit: savings refunded minus a disclosed processing fee. Registration and subscription fees are non-refundable because they are not savings. |
| 8 | Same staff records and verifies | With two or more staff, keep the separation the migration enforces. With a one-person office, allow it, but require the daily per-staff report and an admin sign-off of each day's total. |
| 9 | Sender email, WhatsApp number, domain | Owner must supply. The demo uses a temporary sender and a placeholder wa.me number. |
| 10 | Payment provider | Manual verification is the launch path. Later, a local payment aggregator (owner to compare options), integrated through the Worker. |
| 11 | Privacy and retention | Terms and Privacy stay placeholders. Proposed: keep financial records at least 7 years, delete other personal data on request. The lawyer confirms the period. |
| 12 | Legal clearance | No default. Hard gate before any real money. |
| 13 | Operating entity | Owner must supply. Until then, public pages say "An initiative of Zimbabwe Progressive Youth Foundation" and Terms and Privacy name the entity as a placeholder. |
| 14 | ZPYF branding | Assumed approved, as in the old site footer. Owner to confirm. |

**Highest risk:** items 3 and 12. Ask the owner to confirm both in writing.

**Effect on the build:** items 1, 5 and 6 decide what gets switched on in the demo. Items 2, 4, 7, 10 and 11 stay switched off or placeholder. Item 8 needs no schema change: the database already lets one staff member record and confirm a payment for a member in a single step. It only stops staff paying their own fees. The control is the daily report plus a sign-off by a different admin.

---

## 13. Launch gates (not optional)

- **Zimbabwean legal and regulatory advice before accepting real money.** A scheme that holds member savings and pays out later may fall under deposit-taking, savings-scheme or payment-services rules, and may need licences, approvals or a regulated partner. This blocks launch, not the prototype.
- Owner approval of the prototype, plan amounts and terms
- Payment reconciliation, backups, security checks and support arrangements in place
- Final Terms, Privacy Notice and risk disclosures approved

The prototype may be shown to the owner and tested with sample data. Do not take real members' money until these gates are cleared.

---

## 14. Known limits of this build

- Reversing a savings contribution does not reopen its due item, and reversing a registration fee does not deactivate the account. Both depend on rules the owner has not set.
- No function generates monthly subscription invoices yet, because billing rules are undecided. Staff can still record subscription payments.
- Overdue reminders need a scheduled job, which comes after the owner defines overdue.
- One person recording and verifying payments removes the second check. The audit log, receipts and the daily per-staff report are the compensating controls.
