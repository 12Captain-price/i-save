import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/motion";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/site/EmptyState";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { SearchBox } from "@/components/site/SearchBox";
import { useFaqs } from "@/lib/content";
import { matchesQuery } from "@/lib/list-filter";

export const Route = createFileRoute("/faqs")({
  component: FaqsPage,
});

function FaqsPage() {
  const { data, isPending, isError } = useFaqs();
  const [query, setQuery] = useState("");
  // Which questions are open. A search opens every match so the answers are visible.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const searching = query.trim() !== "";
  const shown = (data ?? []).filter((f) =>
    matchesQuery([f.question, f.answer], query),
  );
  const isOpen = (id: string) => searching || open.has(id);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = shown.length > 0 && shown.every((f) => open.has(f.id));

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
      {data && data.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <SearchBox
            id="faq-search"
            label="Search the questions"
            value={query}
            onChange={setQuery}
            className="min-w-0 flex-1 basis-64 sm:max-w-md"
          />
          {!searching && (
            <button
              type="button"
              onClick={() =>
                setOpen(allOpen ? new Set() : new Set(shown.map((f) => f.id)))
              }
              className="min-h-11 text-sm font-semibold text-primary underline underline-offset-4"
            >
              {allOpen ? "Close all" : "Open all"}
            </button>
          )}
        </div>
      )}
      {searching && data && shown.length === 0 && (
        <EmptyState icon={<HelpCircle />} title="No questions match">
          Try other words, or{" "}
          <Link to="/contact" className="underline underline-offset-4">
            ask the office
          </Link>
          .
        </EmptyState>
      )}
      <div className="grid gap-3">
        {shown.map((faq) => (
          <details
            key={faq.id}
            open={isOpen(faq.id)}
            onToggle={(e) => {
              // Keep our state in step when someone opens or closes one by hand.
              const nowOpen = (e.currentTarget as HTMLDetailsElement).open;
              if (!searching && nowOpen !== open.has(faq.id)) toggle(faq.id);
            }}
            className="group rounded-md border border-border px-5 py-4 open:border-primary/40 open:bg-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:content-none">
              {faq.question}
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180"
              />
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
