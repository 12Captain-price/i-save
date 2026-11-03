import type { ReactNode } from "react";
import { Link, Navigate, Outlet } from "@tanstack/react-router";
import { PublicLayout } from "@/components/site/PublicLayout";
import { buttonVariants } from "@/components/ui/button";
import { AdminModeSwitch } from "@/components/staff/AdminModeSwitch";
import { useAuth } from "@/lib/auth";
import { useIdleTimeout } from "@/lib/idle";
import { isAdminRole, isStaffRole } from "@/lib/staff-utils";
import { cn } from "@/lib/utils";

const TAB_BASE =
  "inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-semibold transition-colors";
const TAB_IDLE = cn(
  TAB_BASE,
  "border-transparent text-muted-foreground hover:text-foreground",
);
const TAB_ACTIVE = cn(TAB_BASE, "border-primary text-foreground");

/** Staff are signed out after 20 minutes without any activity. */
const IDLE_LIMIT_MS = 20 * 60 * 1000;

function Frame({ children }: { children: ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">{children}</div>
    </PublicLayout>
  );
}

/**
 * Layout for everything under /staff. It checks the sign-in and the role once, so each
 * staff page can assume a staff member is looking at it. The database still enforces the
 * same rule on every read and write; this only decides what the screen shows.
 */
export function StaffShell() {
  const { loading, session, roles, signOut } = useAuth();

  // Staff accounts can record money, so an unattended screen signs itself out.
  const { secondsLeft } = useIdleTimeout({
    timeoutMs: IDLE_LIMIT_MS,
    warnMs: 60_000,
    enabled: Boolean(session) && isStaffRole(roles),
    onTimeout: () => void signOut(),
  });

  if (loading) {
    return (
      <Frame>
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      </Frame>
    );
  }
  if (!session) return <Navigate to="/login" />;

  if (!isStaffRole(roles)) {
    return (
      <Frame>
        <h1 className="text-3xl font-semibold">Staff only</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This area is for office staff. If you should have access, ask an
          administrator to add the staff role to your account.
        </p>
        <div className="mt-6">
          <Link
            to="/account"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to my account
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {secondsLeft !== null && (
        <p
          role="alert"
          className="print:hidden mb-4 rounded-md border border-destructive/60 p-3 text-sm"
        >
          You have been inactive. For safety you will be signed out in{" "}
          {secondsLeft} second{secondsLeft === 1 ? "" : "s"}. Move the mouse or
          tap the screen to stay signed in.
        </p>
      )}
      <p className="print:hidden text-[0.7rem] font-bold tracking-[0.16em] text-primary uppercase">
        Staff area
      </p>
      <div className="mt-3 print:hidden">
        <AdminModeSwitch compact />
      </div>
      <nav
        aria-label="Staff"
        className="mt-4 mb-8 flex flex-wrap gap-x-6 border-b border-border print:hidden"
      >
        <Link
          to="/staff"
          activeOptions={{ exact: true }}
          className={TAB_IDLE}
          activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
        >
          Members
        </Link>
        <Link
          to="/staff/dues"
          className={TAB_IDLE}
          activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
        >
          Who is due
        </Link>
        <Link
          to="/staff/report"
          className={TAB_IDLE}
          activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
        >
          Daily report
        </Link>
        <Link
          to="/staff/ledger"
          className={TAB_IDLE}
          activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
        >
          Ledger
        </Link>
        {isAdminRole(roles) && (
          <Link
            to="/staff/audit"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Audit log
          </Link>
        )}
        {isAdminRole(roles) && (
          <Link
            to="/staff/plans"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Plans
          </Link>
        )}
        {isAdminRole(roles) && (
          <Link
            to="/staff/announcements"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Announcements
          </Link>
        )}
        {isAdminRole(roles) && (
          <Link
            to="/staff/events"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Events
          </Link>
        )}
        {isAdminRole(roles) && (
          <Link
            to="/staff/team"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Team
          </Link>
        )}
        {isAdminRole(roles) && (
          <Link
            to="/staff/content"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Pages and FAQs
          </Link>
        )}
        {isAdminRole(roles) && (
          <Link
            to="/staff/accounts"
            className={TAB_IDLE}
            activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
          >
            Staff accounts
          </Link>
        )}
      </nav>
      <Outlet />
    </Frame>
  );
}
