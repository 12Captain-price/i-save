import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/staff-utils";

/** Shows its content to administrators only. The database enforces the same rule. */
export function AdminOnly({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { roles } = useAuth();
  if (isAdminRole(roles)) return <>{children}</>;
  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Only administrators can manage this.
      </p>
      <div className="mt-6">
        <Link to="/staff" className={buttonVariants({ variant: "outline" })}>
          Back to members
        </Link>
      </div>
    </div>
  );
}
