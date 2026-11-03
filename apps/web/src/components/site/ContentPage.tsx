import { LoadingSkeleton } from "@/components/ui/motion";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { usePage, type SitePage } from "@/lib/content";

/** A page whose text staff edit in the admin area (terms, privacy, disclosures). */
export function ContentPage({
  pageKey,
  eyebrow,
  lead,
}: {
  pageKey: SitePage["key"];
  eyebrow: string;
  lead: string;
}) {
  const { data, isPending, isError } = usePage(pageKey);
  return (
    <PageShell eyebrow={eyebrow} title={data?.title ?? eyebrow} lead={lead}>
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          This page could not be loaded. Please try again in a moment.
        </p>
      )}
      {!isPending && !isError && !data && (
        <p className="text-sm text-muted-foreground">
          This page is not available right now. Please contact the office.
        </p>
      )}
      {data && <RichText text={data.body} />}
    </PageShell>
  );
}
