import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { ReviewCard } from "@/components/site/ReviewCard";
import { StarPicker } from "@/components/site/StarRating";
import { TextAreaField, ErrorLine } from "@/components/staff/FormBits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth";
import {
  REVIEW_STATUS_LABEL,
  submitReview,
  useApprovedReviews,
  useMyReviews,
} from "@/lib/reviews";
import { validateReview } from "@/lib/review-utils";
import { staffErrorMessage } from "@/lib/staff-utils";

export const Route = createFileRoute("/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const { data, isPending, isError } = useApprovedReviews();
  return (
    <PageShell
      eyebrow="Member reviews"
      title="What members say about us."
      lead="Real words from people saving with i-Save. Every review is read by the office before it appears here."
    >
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          The reviews could not be loaded. Please try again in a moment.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          There are no reviews yet. Be the first to share yours below.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {data?.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      <section
        aria-labelledby="write-review"
        className="mt-14 rounded-2xl border border-border bg-muted/50 p-6 md:p-8"
      >
        <h2 id="write-review" className="text-2xl font-semibold">
          Write a review
        </h2>
        <WriteReview />
      </section>
    </PageShell>
  );
}

function WriteReview() {
  const { session, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const mine = useMyReviews(userId);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (loading) return null;
  if (!session) {
    return (
      <div className="mt-3">
        <p className="text-sm text-muted-foreground">
          Please sign in to write a review. It only takes a minute.
        </p>
        <Link to="/login" className={buttonVariants({ className: "mt-4" })}>
          Sign in
        </Link>
      </div>
    );
  }

  const shownName = name || profile?.fullName || "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateReview({
      author_name: shownName,
      body,
      rating,
    });
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await submitReview(
        {
          author_name: shownName.trim(),
          author_title: title.trim() || null,
          rating,
          body: body.trim(),
        },
        userId as string,
      );
      await queryClient.invalidateQueries({ queryKey: ["content", "reviews"] });
      setSent(true);
      setBody("");
    } catch (err) {
      setError(staffErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-md border border-primary/40 bg-primary/10 p-4">
        <CheckCircle2
          className="mt-0.5 size-5 text-primary"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold">Thank you!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your review has been sent. It will appear here once the office has
            approved it.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setSent(false)}
          >
            Write another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid max-w-xl gap-4" noValidate>
      <StarPicker value={rating} onChange={setRating} />
      <Field
        id="review-name"
        label="Your name"
        hint="This is shown with your review. Use a first name if you prefer."
        value={shownName}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        autoComplete="name"
      />
      <Field
        id="review-title"
        label="A line about you (optional)"
        hint="For example: Member since 2025, Harare"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
      />
      <TextAreaField
        id="review-body"
        label="Your review"
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={800}
        hint={`${body.trim().length} of 800 characters`}
      />
      <ErrorLine message={error} />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send my review"}
        </Button>
      </div>
      {mine.data && mine.data.length > 0 && (
        <div className="mt-2 border-t border-border pt-4">
          <p className="text-sm font-semibold">Your earlier reviews</p>
          <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
            {mine.data.map((r) => (
              <li key={r.id}>
                “{r.body.length > 70 ? r.body.slice(0, 70) + "…" : r.body}” —{" "}
                <span className="font-medium text-foreground">
                  {REVIEW_STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
