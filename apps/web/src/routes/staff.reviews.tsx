import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { Stars, StarPicker } from "@/components/site/StarRating";
import {
  ErrorLine,
  PageHeading,
  TextAreaField,
} from "@/components/staff/FormBits";
import { StatusPill } from "@/components/staff/StatusPill";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { CheckField, Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import {
  REVIEW_STATUS_LABEL,
  deleteReview,
  saveReview,
  setReviewStatus,
  useAllReviews,
  type Review,
  type ReviewStatus,
} from "@/lib/reviews";
import { validateReview } from "@/lib/review-utils";
import { formatDate } from "@/lib/staff-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/reviews")({
  component: ReviewsAdmin,
});

type Filter = ReviewStatus | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Shown" },
  { key: "rejected", label: "Not shown" },
  { key: "all", label: "All" },
];

function ReviewsAdmin() {
  const { data, isPending, isError } = useAllReviews();
  const [filter, setFilter] = useState<Filter>("pending");
  const [editing, setEditing] = useState<Review | "new" | null>(null);
  const ask = useConfirm();
  const { run, busy, error } = useContentAction();

  const count = (f: Filter) =>
    f === "all"
      ? (data?.length ?? 0)
      : (data?.filter((r) => r.status === f).length ?? 0);
  const shown = (data ?? []).filter(
    (r) => filter === "all" || r.status === filter,
  );

  return (
    <div>
      <PageHeading
        title="Reviews"
        lead="Visitors and clients write reviews on the Reviews page. They stay hidden until you approve them. You can also add a review yourself, fix spelling, or take one down."
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter reviews"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                filter === f.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  f.key === "pending" && count("pending") > 0
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count(f.key)}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add a review
        </Button>
      </div>

      {editing === "new" && (
        <div className="mt-4">
          <ReviewForm initial={null} onDone={() => setEditing(null)} />
        </div>
      )}
      <div className="mt-4">
        <ErrorLine message={error} />
      </div>
      {isPending && <LoadingSkeleton />}
      {isError && <ErrorLine message="The reviews could not be loaded." />}
      {data && shown.length === 0 && editing !== "new" && (
        <p className="mt-6 text-sm text-muted-foreground">
          {filter === "pending"
            ? "Nothing is waiting for approval. Well done."
            : "No reviews here yet."}
        </p>
      )}

      <ul className="mt-4 grid gap-3">
        {shown.map((r) =>
          editing && editing !== "new" && editing.id === r.id ? (
            <li key={r.id}>
              <ReviewForm initial={r} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={r.id}
              className={cn(
                "rounded-md border bg-card p-5",
                r.status === "pending"
                  ? "border-portal-warm/60"
                  : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars rating={r.rating} />
                <StatusPill
                  status={
                    r.status === "approved"
                      ? "active"
                      : r.status === "pending"
                        ? "pending"
                        : "closed"
                  }
                  label={REVIEW_STATUS_LABEL[r.status]}
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed">{r.body}</p>
              <p className="mt-3 text-sm">
                <span className="font-semibold">{r.author_name}</span>
                {r.author_title && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.author_title}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.submitted_by ? "Sent by a member" : "Added by the office"} ·{" "}
                {formatDate(r.created_at)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status !== "approved" && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() => setReviewStatus(r.id, "approved"))
                    }
                  >
                    <Check aria-hidden="true" />
                    Approve
                  </Button>
                )}
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() => setReviewStatus(r.id, "rejected"))
                    }
                  >
                    <X aria-hidden="true" />
                    Reject
                  </Button>
                )}
                {r.status === "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void ask({
                        title: "Take this review down?",
                        message:
                          "It will disappear from the home page and the Reviews page. You can approve it again later.",
                        confirmLabel: "Yes, take it down",
                      }).then((ok) => {
                        if (ok)
                          void run(() => setReviewStatus(r.id, "rejected"));
                      });
                    }}
                  >
                    <EyeOff aria-hidden="true" />
                    Take down
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(r)}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void ask({
                      title: "Delete this review?",
                      message: `The review by ${r.author_name} will be removed for good. This cannot be undone.`,
                      confirmLabel: "Yes, delete",
                      tone: "danger",
                    }).then((ok) => {
                      if (ok) void run(() => deleteReview(r.id));
                    });
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function ReviewForm({
  initial,
  onDone,
}: {
  initial: Review | null;
  onDone: () => void;
}) {
  const { run, busy, error, setError } = useContentAction();
  const [name, setName] = useState(initial?.author_name ?? "");
  const [title, setTitle] = useState(initial?.author_title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [order, setOrder] = useState(String(initial?.sort_order ?? 100));
  const [show, setShow] = useState(
    initial ? initial.status === "approved" : true,
  );
  const idp = initial?.id ?? "new";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateReview({ author_name: name, body, rating });
    if (problem) return setError(problem);
    const sort = Number.parseInt(order, 10);
    const ok = await run(() =>
      saveReview(
        {
          author_name: name.trim(),
          author_title: title.trim() || null,
          rating,
          body: body.trim(),
          sort_order: Number.isFinite(sort) ? sort : 100,
          status: show
            ? "approved"
            : initial && initial.status !== "approved"
              ? initial.status
              : "pending",
        },
        initial?.id,
      ),
    );
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-4 rounded-md border border-primary/40 bg-card p-5"
    >
      <h2 className="text-lg font-semibold">
        {initial ? "Edit review" : "Add a review"}
      </h2>
      <StarPicker
        value={rating}
        onChange={setRating}
        idPrefix={`rating-${idp}`}
      />
      <Field
        id={`rv-name-${idp}`}
        label="Name shown"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
      />
      <Field
        id={`rv-title-${idp}`}
        label="A line about them (optional)"
        hint="For example: Member since 2025, Harare"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
      />
      <TextAreaField
        id={`rv-body-${idp}`}
        label="Review"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={800}
      />
      <Field
        id={`rv-order-${idp}`}
        label="Order"
        hint="Smaller numbers come first. Leave as 100 to keep newest first."
        inputMode="numeric"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
      />
      <CheckField id={`rv-show-${idp}`} checked={show} onChange={setShow}>
        Show on the website
      </CheckField>
      <ErrorLine message={error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save review"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
