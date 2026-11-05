import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Eye,
  Mail,
  Phone,
  RotateCcw,
  StickyNote,
  Trash2,
} from "lucide-react";
import { ErrorLine, PageHeading } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { inputClass } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth";
import {
  STATUS_LABEL,
  deleteFeedback,
  kindLabel,
  saveFeedbackNote,
  setFeedbackStatus,
  useFeedbackInbox,
  type FeedbackItem,
  type FeedbackStatus,
} from "@/lib/feedback";
import { formatDateTime, isAdminRole } from "@/lib/staff-utils";
import { STAFF_TEMPLATES, memberFirstName, whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/feedback")({
  component: FeedbackInbox,
});

type Filter = FeedbackStatus | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "new", label: "New" },
  { key: "seen", label: "Being looked at" },
  { key: "resolved", label: "Done" },
  { key: "all", label: "All" },
];

const KIND_TONE: Record<string, string> = {
  feedback: "bg-primary/15 text-primary",
  request: "bg-portal-accent/20 text-portal-accent",
  idea: "bg-portal-warm/20 text-portal-warm",
  complaint: "bg-destructive/15 text-destructive",
};

function FeedbackInbox() {
  const { data, isPending, isError } = useFeedbackInbox();
  const [filter, setFilter] = useState<Filter>("new");
  const { error } = useContentAction();
  const count = (f: Filter) =>
    f === "all"
      ? (data?.length ?? 0)
      : (data?.filter((i) => i.status === f).length ?? 0);
  const shown = (data ?? []).filter(
    (i) => filter === "all" || i.status === filter,
  );

  return (
    <div>
      <PageHeading
        title="Feedback inbox"
        lead="Messages visitors and clients send from the Send us feedback page. Each one shows who sent it, with a button to reply on WhatsApp. This list refreshes by itself."
      />
      <div
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter messages"
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
                f.key === "new" && count("new") > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {count(f.key)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <ErrorLine message={error} />
      </div>
      {isPending && <LoadingSkeleton />}
      {isError && <ErrorLine message="The messages could not be loaded." />}
      {data && shown.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          {filter === "new"
            ? "No new messages. You are all caught up."
            : "No messages here."}
        </p>
      )}
      <ul className="mt-4 grid gap-4">
        {shown.map((item) => (
          <FeedbackCard key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const { roles } = useAuth();
  const admin = isAdminRole(roles);
  const ask = useConfirm();
  const { run, busy } = useContentAction();
  const [note, setNote] = useState(item.staff_note ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(item.staff_note));

  const who = item.sender;
  const name = who?.full_name || "Unknown sender";
  const link = who?.phone
    ? whatsappLink(
        who.phone,
        STAFF_TEMPLATES.feedback(
          memberFirstName(name),
          kindLabel(item.kind),
          item.subject,
        ),
      )
    : null;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  // Opening a chat counts as having looked at the message.
  function markSeenOnOpen() {
    if (item.status === "new")
      void run(() => setFeedbackStatus(item.id, "seen"));
  }

  return (
    <li
      className={cn(
        "grid gap-5 rounded-md border bg-card p-5 md:grid-cols-[1fr_17rem]",
        item.status === "new" ? "border-primary/60" : "border-border",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              KIND_TONE[item.kind],
            )}
          >
            {kindLabel(item.kind)}
          </span>
          <span
            className={cn(
              "rounded-full border border-current/30 px-2.5 py-0.5 text-xs font-semibold",
              item.status === "new"
                ? "text-destructive"
                : item.status === "seen"
                  ? "text-portal-warm"
                  : "text-primary",
            )}
          >
            {STATUS_LABEL[item.status]}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(item.created_at)}
          </span>
        </div>
        <h2 className="mt-3 text-lg font-semibold">{item.subject}</h2>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
          {item.message}
        </p>

        {noteOpen && (
          <div className="mt-4">
            <label
              htmlFor={`note-${item.id}`}
              className="mb-1.5 block text-xs font-semibold text-muted-foreground"
            >
              Private note (members never see this)
            </label>
            <textarea
              id={`note-${item.id}`}
              className={inputClass}
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy || note.trim() === (item.staff_note ?? "")}
              onClick={() => void run(() => saveFeedbackNote(item.id, note))}
            >
              Save note
            </Button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {item.status !== "seen" && item.status !== "resolved" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => setFeedbackStatus(item.id, "seen"))}
            >
              <Eye aria-hidden="true" />
              Mark as seen
            </Button>
          )}
          {item.status !== "resolved" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(() => setFeedbackStatus(item.id, "resolved"))
              }
            >
              <Check aria-hidden="true" />
              Mark as done
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => setFeedbackStatus(item.id, "new"))}
            >
              <RotateCcw aria-hidden="true" />
              Reopen
            </Button>
          )}
          {!noteOpen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNoteOpen(true)}
            >
              <StickyNote aria-hidden="true" />
              Add note
            </Button>
          )}
          {admin && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void ask({
                  title: "Delete this message?",
                  message: `The message from ${name} will be removed for good. This cannot be undone.`,
                  confirmLabel: "Yes, delete",
                  tone: "danger",
                }).then((ok) => {
                  if (ok) void run(() => deleteFeedback(item.id));
                });
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* The client card: who sent it, and how to reach them. */}
      <aside
        aria-label={`Contact ${name}`}
        className="self-start rounded-xl border border-border bg-muted/50 p-4"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary"
          >
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">
              {who?.member_number
                ? `Member ${who.member_number}`
                : "Website visitor"}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid gap-1.5 text-sm">
          {who?.phone && (
            <div className="flex items-center gap-2">
              <Phone
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Phone</dt>
              <dd>{who.phone}</dd>
            </div>
          )}
          {who?.email && (
            <div className="flex items-center gap-2">
              <Mail
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Email</dt>
              <dd className="truncate">{who.email}</dd>
            </div>
          )}
        </dl>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markSeenOnOpen}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-semibold text-[#06361a] shadow transition-colors hover:bg-[#1fbb59] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Reply on WhatsApp
          </a>
        ) : (
          <p className="mt-4 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            No usable phone number was given, so WhatsApp cannot be opened.
            {who?.email && " Use their email instead."}
          </p>
        )}
        {who?.email && (
          <a
            href={`mailto:${who.email}?subject=${encodeURIComponent(`Re: ${item.subject}`)}`}
            onClick={markSeenOnOpen}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Mail className="size-4" aria-hidden="true" />
            Send an email
          </a>
        )}
      </aside>
    </li>
  );
}
