# Backups and monitoring

The database holds the ledger, so it is the one thing that must never be lost.

## 1. Backups

**Supabase dashboard:** Database > Backups. Paid plans keep daily backups and can restore to
a point in time. The free plan does **not** include backups, so on the free plan use section 2.

Before launch, the owner should decide: paid plan (simplest, recommended once real money is
held for members) or the manual routine below.

## 2. Manual backup (works on any plan)

You need the PostgreSQL tools (`pg_dump`) installed, and the database connection string from
Supabase: Project Settings > Database > Connection string (URI). It contains the database
password, so treat it like a key. Never put it in git.

In PowerShell, from any folder:

```powershell
$env:DB_URL = "postgresql://postgres:YOUR-PASSWORD@db.YOURPROJECT.supabase.co:5432/postgres"
$stamp = Get-Date -Format "yyyy-MM-dd"
pg_dump --no-owner --format=custom --file="isave-$stamp.dump" $env:DB_URL
```

This makes one dated file, for example `isave-2026-11-03.dump`.

- Do it at least weekly, and always before running a new migration.
- Keep the files **off the office computer** too (a second drive or a private cloud folder).
- Keep the last 8 or so. Delete older ones.

## 3. Restore (only into a new, empty project, never over the live one)

```powershell
pg_restore --no-owner --dbname="NEW-PROJECT-CONNECTION-STRING" isave-2026-11-03.dump
```

Practise this once on a test project so the first time is not during an emergency.

## 4. Monitoring

- **Worker logs:** turned on in `workers/api/wrangler.toml` (`[observability]`). Cloudflare
  dashboard > Workers & Pages > i-save > Logs shows API errors and email-sending failures.
- **Failed emails:** rows in `notifications` with `status = 'failed'` (after 5 tries) show in
  the Supabase table editor.
- **Uptime:** add the site address to a free uptime monitor (for example UptimeRobot) with an
  email or WhatsApp alert, so you hear about an outage before members do. The Worker answers
  `/health` for this.
