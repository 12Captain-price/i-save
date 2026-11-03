import { LoadingSkeleton } from "@/components/ui/motion";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { useFaqs } from "@/lib/content";

export const Route = createFileRoute("/faqs")({
  component: FaqsPage,
});

function FaqsPage() {
  const { data, isPending, isError } = useFaqs();
  return (
    <PageShell
      eyebrow="FAQs"
      title="Questions members ask."
      lead="Short answers about joining, paying and saving. If yours is not here, the office can help."
    >
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          The questions could not be loaded. Please try again in a moment.
        </p>
      )}
      <div className="grid gap-3">
        {data?.map((faq) => (
          <details
            key={faq.id}
            className="group rounded-md border border-border px-5 py-4"
          >
            <summary className="cursor-pointer list-none font-semibold marker:content-none">
              {faq.question}
            </summary>
            <RichText
              text={faq.answer}
              className="mt-3 space-y-2 text-sm text-muted-foreground"
            />
          </details>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Still have a question?{" "}
        <Link to="/contact" className="underline underline-offset-4">
          Contact the office
        </Link>
        .
      </p>
    </PageShell>
  );
}
