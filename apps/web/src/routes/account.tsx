import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { MemberDashboard } from "@/components/member/MemberDashboard";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { usePublicFees } from "@/lib/public-fees";
import { isStaffRole } from "@/lib/staff-utils";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function Shell({
  title,
  wide = false,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PublicLayout>
      <div
        className={
          "mx-auto px-6 py-12 md:py-16 " + (wide ? "max-w-4xl" : "max-w-2xl")
        }
      >
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        <div className="mt-8 grid gap-5">{children}</div>
      </div>
    </PublicLayout>
  );
}

function AccountPage() {
  const { loading, session, profile, roles, signOut } = useAuth();
  const fees = usePublicFees();

  if (loading) {
    return (
      <Shell title="Your account">
        <p role="status" className="text-sm text-muted-foreground">
          Loading your account…
        </p>
      </Shell>
    );
  }
  if (!session) return <Navigate to="/login" />;

  const signOutButton = (
    <div>
      <Button variant="outline" onClick={() => void signOut()}>
        Log out
      </Button>
    </div>
  );

  // Office staff get a way into the staff area from whichever account screen they land on.
  const staffCard = isStaffRole(roles) ? (
    <div className="rounded-md border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Staff area</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Find members, check IDs, record office payments and see the daily
        report.
      </p>
      <div className="mt-4">
        <Link to="/staff" className={buttonVariants()}>
          Open the staff area
        </Link>
      </div>
    </div>
  ) : null;

  if (!profile) {
    return (
      <Shell title="Your account">
        {staffCard}
        <p className="text-sm">
          We could not find your member record. Please contact the office and
          quote the email you applied with.
        </p>
        {signOutButton}
      </Shell>
    );
  }

  if (profile.status === "pending") {
    const fee = fees.data?.registration;
    return (
      <Shell title={"Welcome, " + profile.fullName.split(" ")[0]}>
        {staffCard}
        <div className="rounded-md border border-border bg-card p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Member number
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-primary">
            {profile.memberNumber}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Your application is received. Your account is not active yet.
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">To activate your account</h2>
          <ol className="mt-4 grid list-decimal gap-3 pl-5 text-sm">
            <li>
              Visit the office with your <strong>national ID</strong>. Staff
              will check it.
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
            The registration fee is a fee, not savings. It does not count
            towards your savings balance.
          </p>
        </div>
        {signOutButton}
      </Shell>
    );
  }

  if (profile.status === "active") {
    return (
      <Shell title={"Welcome, " + profile.fullName.split(" ")[0]} wide>
        <p className="text-sm text-muted-foreground">
          Member number{" "}
          <strong className="text-foreground">{profile.memberNumber}</strong>
        </p>
        {staffCard}
        <MemberDashboard memberId={profile.id} />
        {signOutButton}
      </Shell>
    );
  }

  return (
    <Shell title="Your account">
      {staffCard}
      <p className="text-sm">
        Your account is not available at the moment. Please contact the office
        for help.
      </p>
      {signOutButton}
    </Shell>
  );
}
