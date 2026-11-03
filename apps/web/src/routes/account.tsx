import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { ActivationWatcher } from "@/components/site/ActivationCelebration";
import { useSignOutWithGoodbye } from "@/components/site/GoodbyeToast";
import { LoadingSkeleton } from "@/components/ui/motion";
import { MemberDashboard } from "@/components/member/MemberDashboard";
import { PublicLayout } from "@/components/site/PublicLayout";
import { AdminModeSwitch } from "@/components/staff/AdminModeSwitch";
import { Button } from "@/components/ui/button";
import { useAuth, type Profile } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { usePublicFees } from "@/lib/public-fees";
import { isAdminRole, isStaffRole } from "@/lib/staff-utils";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        <div className="mt-8 grid gap-6">{children}</div>
      </div>
    </PublicLayout>
  );
}

const STAFF_TILES = [
  {
    to: "/staff",
    label: "Members",
    note: "Find members, check IDs, record payments",
  },
  {
    to: "/staff/register",
    label: "Register someone",
    note: "Sign up an applicant in the office",
  },
  { to: "/staff/report", label: "Daily report", note: "Today’s payments" },
  { to: "/staff/ledger", label: "Ledger", note: "Every money event" },
  {
    to: "/staff/withdrawals",
    label: "Withdrawals",
    note: "Review, approve, pay out",
  },
] as const;

const ADMIN_TILES = [
  {
    to: "/staff/announcements",
    label: "Announcements",
    note: "Write and send notices",
  },
  { to: "/staff/events", label: "Events", note: "Pictures and details" },
  { to: "/staff/team", label: "Team", note: "Photos and hierarchy" },
  {
    to: "/staff/content",
    label: "Pages and FAQs",
    note: "Terms, privacy, questions",
  },
  { to: "/staff/plans", label: "Plans", note: "Savings plans" },
  { to: "/staff/accounts", label: "Staff accounts", note: "Add new staff" },
  { to: "/staff/audit", label: "Audit log", note: "Who did what" },
] as const;

function Tile({
  to,
  label,
  note,
  index = 0,
}: {
  to: (typeof STAFF_TILES)[number]["to"] | (typeof ADMIN_TILES)[number]["to"];
  label: string;
  note: string;
  index?: number;
}) {
  return (
    <Link
      to={to}
      style={{ ["--i" as string]: index }}
      className="stagger-in lift block rounded-md border border-border bg-background p-4 hover:border-primary"
    >
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Link>
  );
}

/** The way into every staff tool, so staff never have to hunt for it. */
function StaffWorkspace() {
  const { roles } = useAuth();
  return (
    <section
      aria-labelledby="staff-workspace"
      className="grid gap-4 rounded-md border border-border bg-card p-6"
    >
      <h2 id="staff-workspace" className="text-lg font-semibold">
        Staff workspace
      </h2>
      <AdminModeSwitch />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAFF_TILES.map((t, i) => (
          <Tile key={t.to} {...t} index={i} />
        ))}
      </div>
      {isAdminRole(roles) && (
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Administration
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADMIN_TILES.map((t, i) => (
              <Tile key={t.to} {...t} index={STAFF_TILES.length + i} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** The person's own member account while it is waiting to be activated. A slim strip, not a wall. */
function PendingStrip({
  profile,
  openByDefault,
}: {
  profile: Profile;
  openByDefault: boolean;
}) {
  const fees = usePublicFees();
  const fee = fees.data?.registration;
  return (
    <details
      open={openByDefault}
      className="rounded-md border border-border bg-card px-5 py-4"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 marker:content-none">
        <span className="text-sm">
          <span className="font-semibold">Your member account</span>{" "}
          <span className="text-muted-foreground">
            · {profile.memberNumber}
          </span>
        </span>
        <span className="rounded-full border border-border px-3 py-0.5 text-xs font-semibold text-muted-foreground">
          Not active yet · how to activate
        </span>
      </summary>
      <div className="mt-4 text-sm">
        <ol className="grid list-decimal gap-3 pl-5">
          <li>
            Visit the office with your <strong>national ID</strong>. Staff will
            check it.
          </li>
          <li>
            Pay the one-time registration fee
            {fee ? (
              <>
                {" "}
                of <strong>{formatMoney(fee.amount, fee.currency)}</strong>
              </>
            ) : null}
            . Staff will record it and give you a numbered receipt.
          </li>
          <li>Once both are done, your account becomes active.</li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          The registration fee is a fee, not savings. It does not count towards
          your savings balance.
        </p>
      </div>
    </details>
  );
}

function AccountPage() {
  const { loading, session, profile, roles } = useAuth();
  const signOut = useSignOutWithGoodbye();

  if (loading) {
    return (
      <Shell title="Your account">
        <LoadingSkeleton lines={4} />
      </Shell>
    );
  }
  if (!session) return <Navigate to="/login" />;

  const staff = isStaffRole(roles);
  const signOutButton = (
    <div>
      <Button variant="outline" onClick={() => void signOut()}>
        Log out
      </Button>
    </div>
  );

  if (!profile) {
    return (
      <Shell title="Your account">
        {staff && <StaffWorkspace />}
        <p className="text-sm">
          We could not find your member record. Please contact the office and
          quote the email you applied with.
        </p>
        {signOutButton}
      </Shell>
    );
  }

  const firstName = profile.fullName.split(" ")[0] || "there";

  return (
    <Shell title={"Welcome, " + firstName}>
      {staff && <StaffWorkspace />}

      {profile.status === "pending" && (
        <>
          <ActivationWatcher profile={profile} />
          <PendingStrip profile={profile} openByDefault={!staff} />
        </>
      )}

      {profile.status === "active" && (
        <>
          <ActivationWatcher profile={profile} />
          <p className="text-sm text-muted-foreground">
            Member number{" "}
            <strong className="text-foreground">{profile.memberNumber}</strong>
            {" · "}
            <Link
              to="/statement"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Download my statement
            </Link>
          </p>
          <MemberDashboard
            memberId={profile.id}
            memberName={profile.fullName}
            memberNumber={profile.memberNumber}
          />
        </>
      )}

      {profile.status !== "pending" && profile.status !== "active" && (
        <p className="text-sm">
          Your member account is not available at the moment. Please contact the
          office for help.
        </p>
      )}

      {signOutButton}
    </Shell>
  );
}
