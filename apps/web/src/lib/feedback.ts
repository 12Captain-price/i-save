import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// The feedback inbox. Visitors and clients (no sign-in) send feedback, requests, ideas and
// complaints with their name and a phone or email. Only staff can read them, see who sent each
// one, and reply on WhatsApp or email.

export const FEEDBACK_KINDS = [
  { key: "feedback", label: "Feedback", hint: "Tell us what you think" },
  { key: "request", label: "Request", hint: "Ask us for something" },
  { key: "idea", label: "Idea", hint: "Suggest an improvement" },
  { key: "complaint", label: "Complaint", hint: "Something went wrong" },
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]["key"];
export type FeedbackStatus = "new" | "seen" | "resolved";

export const kindLabel = (kind: string) =>
  FEEDBACK_KINDS.find((k) => k.key === kind)?.label ?? kind;

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "New",
  seen: "Being looked at",
  resolved: "Done",
};

const one = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (Array.isArray(v) ? (v[0] ?? null) : v), schema);

const Sender = z.object({
  full_name: z.string(),
  member_number: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});
export type FeedbackSender = z.infer<typeof Sender>;

const FeedbackRow = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  sender_name: z.string().nullable(),
  sender_phone: z.string().nullable(),
  sender_email: z.string().nullable(),
  kind: z.enum(["feedback", "request", "idea", "complaint"]),
  subject: z.string(),
  message: z.string(),
  status: z.enum(["new", "seen", "resolved"]),
  staff_note: z.string().nullable(),
  handled_at: z.string().nullable(),
  created_at: z.string(),
  sender: one(Sender.nullable()),
});
export type FeedbackItem = z.infer<typeof FeedbackRow>;

const STAFF_SELECT =
  "id, user_id, sender_name, sender_phone, sender_email, kind, subject, message, status, staff_note, handled_at, created_at, sender:profiles(full_name, member_number, phone, email)";

export const useFeedbackInbox = () =>
  useQuery({
    queryKey: ["feedback", "inbox"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<FeedbackItem[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select(STAFF_SELECT)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return z
        .array(FeedbackRow)
        .parse(data ?? [])
        .map((row) => ({
          ...row,
          // Visitors have no profile, so use the contact details they typed in.
          sender:
            row.sender ??
            (row.sender_name
              ? {
                  full_name: row.sender_name,
                  member_number: "",
                  phone: row.sender_phone,
                  email: row.sender_email,
                }
              : null),
        }));
    },
  });

export type FeedbackValues = {
  kind: FeedbackKind;
  subject: string;
  message: string;
  sender_name: string;
  sender_phone: string | null;
  sender_email: string | null;
};

/** Anyone can send feedback. No account needed. */
export async function sendFeedback(values: FeedbackValues) {
  const { error } = await supabase.from("feedback").insert(values);
  if (error) throw error;
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus) {
  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function saveFeedbackNote(id: string, note: string) {
  const { error } = await supabase
    .from("feedback")
    .update({ staff_note: note.trim() === "" ? null : note.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFeedback(id: string) {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}

/**
 * How many things are waiting for staff: new feedback and reviews to approve. Counts only, so it
 * is cheap to refresh every half minute. Pass enabled=false for anyone who is not staff.
 */
export const useWaitingCounts = (enabled: boolean) =>
  useQuery({
    queryKey: ["feedback", "waiting"],
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [feedback, reviews] = await Promise.all([
        supabase
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      if (feedback.error) throw feedback.error;
      if (reviews.error) throw reviews.error;
      return { feedback: feedback.count ?? 0, reviews: reviews.count ?? 0 };
    },
  });
