import { LoadingSkeleton } from "@/components/ui/motion";
import { useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { PublicLayout } from "@/components/site/PublicLayout";
import { buttonVariants } from "@/components/ui/button";
import { AdminModeSwitch } from "@/components/staff/AdminModeSwitch";
import { useAuth } from "@/lib/auth";
import { useWaitingCounts } from "@/lib/feedback";
import { isAdminRole, isStaffRole } from "@/lib/staff-utils";
import { cn } from "@/lib/utils";

const TAB_BASE =
  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-1 text-sm font-semibold transition-colors";
const TAB_IDLE = cn(
  TAB_BASE,
  "border-transparent text-muted-foreground hover:text-foreground",
);
const TAB_ACTIVE = cn(TAB_BASE, "border-primary text-primary");

const TABS = [
  { to: "/staff", label: "Overview", exact: true, admin: false },
  { to: "/staff/feedback", label: "Feedback", admin: false, badge: "feedback" },
  { to: "/staff/reviews", label: "Reviews", admin: false, badge: "reviews" },
  { to: "/staff/announcements", label: "Announcements", admin: true },
  { to: "/staff/events", label: "Events", admin: true },
  { to: "/staff/plans", label: "Plans", admin: true },
  { to: "/staff/team", label: "Team", admin: true },
  { to: "/staff/agents", label: "Agents", admin: true },
  { to: "/staff/traffic", label: "Traffic report", admin: true },
  { to: "/staff/content", label: "Home page, goals, pages", admin: true },
] as const;

/**
 * One row of tabs. On a phone it swipes sideways instead of wrapping onto four lines that
 * push the page down, and the current tab is scrolled into view so you can see where you are.
 */
function StaffTabs({ admin }: { admin: boolean }) {
  const strip = useRef<HTMLElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const waiting = useWaitingCounts(true).data;
  useEffect(() => {
    const active = strip.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (!active || !strip.current) return;
    const box = strip.current;
    box.scrollLeft = Math.max(
      0,
      active.offsetLeft - (box.clientWidth - active.offsetWidth) / 2,
    );
  }, [path]);
  return (
    <nav
      ref={strip}
      aria-label="Admin"
      className="-mx-6 mt-4 mb-8 flex gap-x-6 overflow-x-auto border-b border-border px-6 print:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {TABS.filter((t) => admin || !t.admin).map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: "exact" in t && t.exact }}
          className={TAB_IDLE}
          activeProps={{ className: TAB_ACTIVE, "aria-current": "page" }}
        >
          {t.label}
          {"badge" in t && waiting && waiting[t.badge] > 0 && (
            <span
              className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.7rem] leading-5 font-bold text-destructive-foreground"
              title={`${waiting[t.badge]} waiting for you`}
            >
              <span aria-hidden="true">{waiting[t.badge]}</span>
              <span className="sr-only">{waiting[t.badge]} waiting</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

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
  const { loading, session, roles } = useAuth();

  if (loading) {
    return (
      <Frame>
        <LoadingSkeleton />
      </Frame>
    );
  }
  if (!session) return <Navigate to="/login" />;

  if (!isStaffRole(roles)) {
    return (
      <Frame>
        <h1 className="text-3xl font-semibold">Staff only</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This area is for administrators. If you should have access, ask an
          administrator to add the role to your account.
        </p>
        <div className="mt-6">
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Back to the site
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <p className="print:hidden text-[0.7rem] font-bold tracking-[0.16em] text-primary uppercase">
        Admin
      </p>
      <div className="mt-3 print:hidden">
        <AdminModeSwitch compact />
      </div>
      <StaffTabs admin={isAdminRole(roles)} />
      <Outlet />
    </Frame>
  );
}
