# iSave

The public website for i-Save, a member savings programme run by the Zimbabwe Progressive Youth Foundation (ZPYF) in Bulawayo.

The site explains the savings goals, plans and fees, shares news and events, and sends people who want to join to a **registration agent**. Registration and payments are handled in the agents' own system, not on this website. Administrators manage the site from the staff area.

**Status:** prototype. It is not cleared to hold real members' money. See "Launch gates" below.

---

## 1. Confirmed decisions

| Topic                      | Decision                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What this site does        | Informs and hands off. It does not register members, take payments or show personal accounts.                                                                                                                          |
| Joining                    | The Apply page lists the registration agents. Each button opens that agent's own registration page in a new tab.                                                                                                       |
| Counting handoffs          | A click on an agent's button is the count. The two systems are deliberately not linked, so finished registrations are not counted here.                                                                                |
| Savings plans              | The five categories: Asset, Holiday, Emergency, Retrenchment, Education, plus one featured goal-based plan. Plans stay as drafts until the owner approves amounts and terms. No amount is ever invented or hard-coded. |
| Interest, bonuses, returns | Not offered, calculated or advertised. Figures for coming months are scheduled targets, never projected returns.                                                                                                       |
| Currency                   | USD.                                                                                                                                                                                                                   |
| Hosting                    | Git repository, deployed to Cloudflare as one Worker that serves the website and the API. Supabase for the database and sign-in.                                                                                       |

---

## 2. Stack

- **Front end:** React 19, TypeScript, TanStack (Router, Query), Tailwind CSS, shadcn/ui, Zod
- **Database and sign-in:** Supabase (Postgres, Row Level Security, Supabase Auth)
- **Server side:** one Cloudflare Worker (`workers/api`) that also serves the built website
- **Assistant:** Cloudflare Workers AI (free tier), or Claude if an Anthropic key is set instead
- **Email:** Resend (off until configured)
- **Money handling:** `numeric(14,2)` in Postgres and `decimal.js` in the browser, never JavaScript floats
- **Testing:** Vitest

---

## 3. Architecture

```
Browser (React)
   |  anon key (+ user JWT for staff)
   v
Supabase -------------------------------------------------------------
   Auth       Postgres: tables + RLS + functions (the rules live here)
              - record_traffic()   visitors add counts (checked, rate-limited)
              - traffic_summary()  administrators read the figures
   ^
   |  service role key (Worker only, never in the browser)
Cloudflare Worker  (serves the website and these endpoints)
   - /assistant   the in-site assistant
   - /health
   - /staff/register-member, /staff/create-staff   kept, but no screen uses them now
   - cron every minute: sends queued emails (does nothing until Resend is set up)
```

**Where the rules live.** The rules are in the database, not in the React code, so no screen or future developer can bypass them:

- Visitors can read only published content, and only plans that have an approved, live version.
- Visitors cannot read or write the traffic table directly. They can only call `record_traffic()`, which validates every event.
- Only administrators can change content, plans, agents and read traffic.
- An active plan version's terms cannot be edited. Changes need a new version.

---

## 4. Screens

**Public:** Home, How it works, Savings plans, Fees, FAQs, Contact, Terms, Privacy, Risk and withdrawal disclosure, Apply, Announcements, Events, Team, Login.

- **Home** has the welcome hero (ribbons play once on load), count-up stat tiles and an interactive month-by-month dashboard.
- **Plans** shows each approved plan with its short description, a full "About this plan" description and its terms. The goal-based plan is shown large at the top with a goal planner (goal amount divided by weeks, rounded up to the next cent; no interest or returns).
- **Apply** shows one "Register with ..." button per published agent.

**Staff area (`/staff`)**, admin tabs:

| Tab                         | What it does                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Announcements, Events, Team | Content shown on the public site                                                                 |
| Pages, FAQs, contact        | Public pages, the FAQ list and office contact details                                            |
| Plans                       | Add plans, short and full descriptions, versions, approve and activate, mark the goal-based plan |
| Agents                      | The registration agents on the Apply page: name, https link, note, order, show or hide           |
| Traffic                     | Page views, visitors, Apply clicks and agent handoffs with date filters                          |

Roles: `finance`, `admin`, `super_admin`. Finance staff can switch on Admin mode to use the admin tabs. Staff are signed out after 20 minutes without activity.

---

## 5. Database

Migrations are in `supabase/migrations`, run in order in the Supabase SQL Editor.

| Migration  | Adds                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 001 to 008 | Core schema: profiles, roles, settings, plans and versions, payments, ledger, receipts, audit log |
| 009        | Site content: pages, FAQs, announcements, events, team                                            |
| 010        | Staff Admin mode                                                                                  |
| 011 to 016 | Withdrawals, receipt checks, support contacts, office contact                                     |
| 017        | `agents` table (registration agents)                                                              |
| 018        | `traffic_events`, `record_traffic()`, `traffic_summary()`                                         |
| 019        | `long_description` and `is_goal_based` on `savings_plans` (one goal-based plan at a time)         |

The ledger, payment and member tables from the earlier build are **left in place** and unused by this site, so nothing is lost if the other application needs the data. Only the screens were removed.

Tests for the database rules: `supabase/tests/` (run with `run_local.sh` against a throwaway local Postgres, never against Supabase).

### Traffic tracking

- Three events: page view, click on a link to the Apply page, click on an agent's button.
- A visitor is a random code kept in the browser. No names, phone numbers, emails or IP addresses are stored.
- Signed-in staff are not counted. Admin and sign-in pages are never counted.
- A script cannot flood the table: more than 30 events a minute from one visitor code are ignored.
- Days are Zimbabwe days (Africa/Harare).
- The privacy page may deserve a sentence saying the site counts visits anonymously. That wording is for the owner to approve.

---

## 6. The assistant

The assistant reads its facts from `workers/api/src/assistant-knowledge.ts`. Edit that file when a screen or rule changes, then redeploy. It also reads the live approved settings and published FAQs from the database on every question, so those cannot go out of date.

Three guides exist: visitors (home), signed-in members, and staff. The knowledge file says plainly that this site no longer takes payments or shows accounts, so it must not invent steps for them. The tests in `workers/api/src/assistant.test.ts` check that.

---

## 7. Environment variables

| Name                           | Where                          | Notes                                                  |
| ------------------------------ | ------------------------------ | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`            | Front end                      | Public                                                 |
| `VITE_SUPABASE_ANON_KEY`       | Front end                      | Public (publishable) key only                          |
| `SUPABASE_URL`                 | Worker (`wrangler.toml`)       |                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`    | Worker, as a Cloudflare secret | Never in the front end or the repo                     |
| `ALLOWED_ORIGIN`, `APP_URL`    | Worker (`wrangler.toml`)       | The live address of the site                           |
| `RESEND_API_KEY`, `EMAIL_FROM` | Worker                         | Optional until email is set up                         |
| `ASSISTANT_MODEL`              | Worker                         | Free Workers AI model; change it if it is ever retired |
| `ANTHROPIC_API_KEY`            | Worker, secret                 | Optional. Only used if there is no AI binding          |

No live credentials go in the repository. Use Cloudflare secrets. For local work copy `workers/api/.dev.vars.example` to `.dev.vars`.

---

## 8. Setup and deploy

1. Create a Supabase project. In the SQL Editor run every file in `supabase/migrations` in order (001 to 019).
2. Sign up once in the app, then promote yourself:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'super_admin' from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
3. Set the environment variables above.
4. Check everything, then deploy:
   ```powershell
   pnpm build
   pnpm typecheck
   pnpm test
   git add -A
   git commit -m "Describe the change"
   git push
   ```
   Cloudflare builds and deploys from the push. The Worker serves `apps/web/dist`.
5. Back up the database (see `docs/BACKUPS.md`) before any real use.

Useful commands: `pnpm dev` (website), `pnpm dev:worker` (Worker), `pnpm check` (typecheck, lint and tests).

---

## 9. Replace before launch

These are placeholders so the site could be built and shown. None of them may go live as they are.

- **Registration agents.** Three placeholder agents with links on example.com. Replace them under Staff > Agents. A red "Placeholder link" warning shows until you do.
- **Members tile on the home page.** The member count is an illustrative figure. Set `HOME_MEMBER_COUNT` in `apps/web/src/lib/home-stats.ts` to a number the owner approves, or to `null` to hide the tile.
- **Home dashboard.** The chart uses built-in demo figures and says "Illustrative demo figures" while `DASHBOARD_IS_DEMO` in `apps/web/src/lib/home-dashboard.ts` is `true`. Replace the demo series with real monthly summaries the owner approves, then set it to `false`. Whether to show real totals publicly is the owner's decision. Keep them as summaries only, with coming months shown as scheduled targets, never projected returns.
- **Plan amounts and terms.** Nothing is live until the owner approves real amounts and terms and an administrator activates a version.
- **Office hours** have not been published, and the assistant is told not to state any.

---

## 10. Launch gates (not optional)

- **Zimbabwean legal and regulatory advice before accepting real money.** A scheme that holds member savings and pays out later may fall under deposit-taking, savings-scheme or payment-services rules, and may need licences, approvals or a regulated partner. This blocks launch, not the prototype.
- Owner approval of the site, plan amounts and terms
- Items in section 9 replaced
- Backups, security checks and support arrangements in place
- Final Terms, Privacy Notice and risk disclosures approved

---

## 11. Known limits

- Finished registrations are not counted. The site only sees clicks that leave for an agent's system.
- The home dashboard shows demo figures until real summaries are supplied.
- The Worker endpoints for registering members and creating staff accounts still exist but no screen uses them.
- Withdrawal, receipt and ledger tables are kept but have no screens here.
