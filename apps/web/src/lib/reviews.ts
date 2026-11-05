import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// Member reviews. Visitors read approved ones only. Signed-in members can send one, which waits
// for staff approval. Staff and admins can add, edit, approve, reject and delete. The database
// enforces all of this; the screens only decide what to show.

const COLUMNS =
  "id, author_name, author_title, rating, body, status, sort_order, submitted_by, approved_at, created_at";

const ReviewRow = z.object({
  id: z.string(),
  author_name: z.string(),
  author_title: z.string().nullable(),
  rating: z.number(),
  body: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  sort_order: z.number(),
  submitted_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
});
export type Review = z.infer<typeof ReviewRow>;
export type ReviewStatus = Review["status"];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Waiting for approval",
  approved: "Shown on the website",
  rejected: "Not shown",
};

/** Approved reviews for the home page and Reviews page (optionally just the first few). */
export const useApprovedReviews = (limit?: number) =>
  useQuery({
    queryKey: ["content", "reviews", "approved", limit ?? "all"],
    queryFn: async (): Promise<Review[]> => {
      let q = supabase
        .from("reviews")
        .select(COLUMNS)
        .eq("status", "approved")
        .order("sort_order", { ascending: true })
        .order("approved_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return z.array(ReviewRow).parse(data ?? []);
    },
  });

/** Every review, for staff. The database hides pending and rejected ones from anyone else. */
export const useAllReviews = () =>
  useQuery({
    queryKey: ["content", "reviews", "all"],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select(COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return z.array(ReviewRow).parse(data ?? []);
    },
  });

/** A member's own reviews, so they can see theirs is waiting. */
export const useMyReviews = (userId: string | undefined) =>
  useQuery({
    queryKey: ["content", "reviews", "mine", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select(COLUMNS)
        .eq("submitted_by", userId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return z.array(ReviewRow).parse(data ?? []);
    },
  });

export type ReviewValues = {
  author_name: string;
  author_title: string | null;
  rating: number;
  body: string;
};

/** A signed-in member sends a review. It always starts as pending. */
export async function submitReview(values: ReviewValues, userId: string) {
  const { error } = await supabase
    .from("reviews")
    .insert({ ...values, status: "pending", submitted_by: userId });
  if (error) throw error;
}

/** Staff add or edit a review. A new one added by staff can be shown straight away. */
export async function saveReview(
  values: ReviewValues & { status?: ReviewStatus; sort_order?: number },
  id?: string,
) {
  const { error } = id
    ? await supabase.from("reviews").update(values).eq("id", id)
    : await supabase.from("reviews").insert(values);
  if (error) throw error;
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  const { error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReview(id: string) {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}
