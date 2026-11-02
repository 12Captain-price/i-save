import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/staff/AdminOnly";
import {
  ErrorLine,
  FORMAT_HINT,
  PageHeading,
  TextAreaField,
} from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import {
  deleteFaq,
  savePage,
  saveFaq,
  useAllPages,
  useFaqs,
  type Faq,
  type SitePage,
} from "@/lib/content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/content")({
  component: () => (
    <AdminOnly title="Pages and FAQs">
      <ContentAdmin />
    </AdminOnly>
  ),
});

function ContentAdmin() {
  const [tab, setTab] = useState<"pages" | "faqs">("pages");
  return (
    <div>
      <PageHeading
        title="Pages and FAQs"
        lead="Edit the Terms, Privacy notice, Risk disclosure and the FAQs. Changes show on the website as soon as you save."
      />
      <div role="tablist" className="mt-6 mb-8 flex gap-2">
        {(["pages", "faqs"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 rounded-md border px-4 text-sm font-semibold",
              tab === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input",
            )}
          >
            {t === "pages" ? "Pages" : "FAQs"}
          </button>
        ))}
      </div>
      {tab === "pages" ? <PagesEditor /> : <FaqsEditor />}
    </div>
  );
}

const PAGE_LABEL: Record<SitePage["key"], string> = {
  terms: "Terms and conditions",
  privacy: "Privacy notice",
  disclosures: "Risk and withdrawal disclosure",
};

function PagesEditor() {
  const { data, isPending, isError } = useAllPages();
  const [open, setOpen] = useState<SitePage["key"] | null>(null);
  if (isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading…
      </p>
    );
  if (isError || !data)
    return <ErrorLine message="The pages could not be loaded." />;
  return (
    <div className="grid gap-4">
      {data.map((page) => (
        <div key={page.key} className="rounded-md border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{PAGE_LABEL[page.key]}</h2>
              <p className="text-xs text-muted-foreground">
                {page.published
                  ? "Showing on the website"
                  : "Hidden from the website"}{" "}
                ·{" "}
                <a
                  className="underline"
                  href={"/" + page.key}
                  target="_blank"
                  rel="noreferrer"
                >
                  View page
                </a>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(open === page.key ? null : page.key)}
            >
              {open === page.key ? "Close" : "Edit"}
            </Button>
          </div>
          {open === page.key && (
            <PageForm page={page} onDone={() => setOpen(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

function PageForm({ page, onDone }: { page: SitePage; onDone: () => void }) {
  const { run, busy, error } = useContentAction();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [published, setPublished] = useState(page.published);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (
      await run(() =>
        savePage(page.key, { title: title.trim(), body, published }),
      )
    )
      onDone();
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <Field
        id={`t-${page.key}`}
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextAreaField
        id={`b-${page.key}`}
        label="Text"
        rows={18}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint={FORMAT_HINT}
      />
      <CheckField
        id={`p-${page.key}`}
        checked={published}
        onChange={setPublished}
      >
        Show this page on the website
      </CheckField>
      <ErrorLine message={error} />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save page"}
        </Button>
      </div>
    </form>
  );
}

function FaqsEditor() {
  const { data, isPending, isError } = useFaqs(true);
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const { run, error } = useContentAction();
  if (isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading…
      </p>
    );
  if (isError || !data)
    return <ErrorLine message="The FAQs could not be loaded." />;
  const nextOrder = (data.at(-1)?.sort_order ?? 0) + 10;
  return (
    <div className="grid gap-4">
      <div>
        <Button onClick={() => setEditing("new")}>Add a question</Button>
      </div>
      <ErrorLine message={error} />
      {editing === "new" && (
        <FaqForm
          key="new"
          initial={null}
          order={nextOrder}
          onDone={() => setEditing(null)}
        />
      )}
      {data.map((faq) =>
        editing && editing !== "new" && editing.id === faq.id ? (
          <FaqForm
            key={faq.id}
            initial={faq}
            order={faq.sort_order}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div
            key={faq.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{faq.question}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {faq.answer}
              </p>
              {!faq.published && (
                <p className="mt-1 text-xs text-destructive">Hidden</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(faq)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm("Delete this question?"))
                    void run(() => deleteFaq(faq.id));
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function FaqForm({
  initial,
  order,
  onDone,
}: {
  initial: Faq | null;
  order: number;
  onDone: () => void;
}) {
  const { run, busy, error } = useContentAction();
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [sort, setSort] = useState(String(order));
  const [published, setPublished] = useState(initial?.published ?? true);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    const ok = await run(() =>
      saveFaq(
        {
          question: question.trim(),
          answer,
          sort_order: Number(sort) || 100,
          published,
        },
        initial?.id,
      ),
    );
    if (ok) onDone();
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border border-primary/40 p-5"
    >
      <Field
        id="faq-q"
        label="Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <TextAreaField
        id="faq-a"
        label="Answer"
        rows={5}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        hint={FORMAT_HINT}
      />
      <Field
        id="faq-order"
        label="Order"
        type="number"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        hint="Smaller numbers show first."
      />
      <CheckField id="faq-pub" checked={published} onChange={setPublished}>
        Show on the website
      </CheckField>
      <ErrorLine message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
