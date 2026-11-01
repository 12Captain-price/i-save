import type { ReactNode } from "react";
import { PublicLayout } from "@/components/site/PublicLayout";

export function AuthCard({
  title,
  lead,
  wide = false,
  children,
}: {
  title: string;
  lead?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <PublicLayout>
      <div
        className={
          "mx-auto px-6 py-12 md:py-16 " + (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {lead && <p className="mt-3 text-muted-foreground">{lead}</p>}
        <div className="mt-8 rounded-md border border-border bg-card p-6">
          {children}
        </div>
      </div>
    </PublicLayout>
  );
}
