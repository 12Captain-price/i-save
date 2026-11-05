import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { ReviewCard } from "@/components/site/ReviewCard";
import { StarPicker } from "@/components/site/StarRating";
import { TextAreaField, ErrorLine } from "@/components/staff/FormBits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { submitReview, useApprovedReviews } from "@/lib/reviews";
import { validateReview } from "@/lib/review-utils";
import { staffErrorMessage } from "@/lib/staff-utils";

export const Route = createFileRoute("/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const { data, isPending, isError } = useApprovedReviews();
  return (
    <PageShell
      eyebrow="Reviews"
      title="What our clients say about us."
      lead="Real words from people who use i-Save. Every review is read by the office before it appears here."
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
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [trap, setTrap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateReview({
      author_name: name,
      body,
      rating,
    });
    if (problem) return setError(problem);
    setError(null);
    // Bots fill in the hidden field. Pretend it worked and send nothing.
    if (trap) {
      setSent(true);
      return;
    }
    setBusy(true);
    try {
      await submitReview({
        author_name: name.trim(),
        author_title: title.trim() || null,
        rating,
        body: body.trim(),
      });
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
    <form
      onSubmit={onSubmit}
      className="relative mt-4 grid max-w-xl gap-4"
      noValidate
    >
      <StarPicker value={rating} onChange={setRating} />
      <Field
        id="review-name"
        label="Your name"
        hint="This is shown with your review. Use a first name if you prefer."
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        autoComplete="name"
      />
      <Field
        id="review-title"
        label="A line about you (optional)"
        hint="For example: Client since 2025, Harare"
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
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="review-website">Leave this empty</label>
        <input
          id="review-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>
      <ErrorLine message={error} />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send my review"}
        </Button>
      </div>
    </form>
  );
}
