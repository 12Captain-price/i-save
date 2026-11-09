import { useConfirm } from "@/components/ui/confirm";
import { LoadingSkeleton } from "@/components/ui/motion";
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
import { MediaEditor } from "@/components/staff/MediaEditor";
import { Photo } from "@/components/site/Photo";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import {
  addEventMedia,
  deleteEvent,
  deleteEventPicture,
  eventCoverPath,
  saveEvent,
  saveMediaDetails,
  useEvents,
  type EventMedia,
  type PendingFile,
  type SiteEvent,
} from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";
import { formatDate } from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/events")({
  component: () => (
    <AdminOnly title="Events">
      <EventsAdmin />
    </AdminOnly>
  ),
});

function EventsAdmin() {
  const { data, isPending, isError } = useEvents(true);
  const [editing, setEditing] = useState<SiteEvent | "new" | null>(null);
  const ask = useConfirm();
  const { run, error } = useContentAction();
  return (
    <div>
      <PageHeading
        title="Events"
        lead="Add recent events with their details and pictures. Tick “Show on the website” when it is ready."
      />
      <div className="mt-6">
        <Button onClick={() => setEditing("new")}>Add an event</Button>
      </div>
      <div className="mt-4">
        <ErrorLine message={error} />
      </div>
      <div className="mt-6 grid gap-4">
        {editing === "new" && (
          <EventForm initial={null} onDone={() => setEditing(null)} />
        )}
        {isPending && <LoadingSkeleton />}
        {isError && <ErrorLine message="Events could not be loaded." />}
        {data?.map((ev) =>
          editing && editing !== "new" && editing.id === ev.id ? (
            <EventForm
              key={ev.id}
              initial={ev}
              onDone={() => setEditing(null)}
            />
          ) : (
            <div
              key={ev.id}
              className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4"
            >
              <Photo
                path={eventCoverPath(ev)}
                alt=""
                className="h-16 w-24 rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(ev.event_date)} · {ev.images.length} file
                  {ev.images.length === 1 ? "" : "s"} ·{" "}
                  {ev.published ? "Showing" : "Draft"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(ev)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void ask({
                      title: `Delete "${ev.title}"?`,
                      message:
                        "The event and all of its pictures, videos and PDFs will be removed. This cannot be undone.",
                      confirmLabel: "Yes, delete",
                      tone: "danger",
                    }).then((ok) => {
                      if (ok) void run(() => deleteEvent(ev));
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function EventForm({
  initial,
  onDone,
}: {
  initial: SiteEvent | null;
  onDone: () => void;
}) {
  const ask = useConfirm();
  const { run, busy, error, setError } = useContentAction();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(
    initial?.event_date ?? new Date().toISOString().slice(0, 10),
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  // The files already on the event (with captions and order being edited) and new ones waiting.
  const [existing, setExisting] = useState<EventMedia[]>(initial?.images ?? []);
  const [pending, setPending] = useState<PendingFile[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) {
      setError("Enter a title and a date.");
      return;
    }
    const ok = await run(async () => {
      const id = await saveEvent(
        {
          title: title.trim(),
          event_date: date,
          location: location.trim() || null,
          summary: summary.trim() || null,
          details: details.trim() || null,
          published,
        },
        initial?.id,
      );
      if (initial && existing.length) {
        await saveMediaDetails("event_images", existing);
      }
      if (pending.length) {
        await addEventMedia(id, pending, existing.length * 10);
      }
    });
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border border-primary/40 p-5"
    >
      <Field
        id="ev-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="ev-date"
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Field
          id="ev-loc"
          label="Place (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <TextAreaField
        id="ev-sum"
        label="Short summary"
        rows={2}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        hint="Shown on the events list and the homepage."
      />
      <TextAreaField
        id="ev-det"
        label="Full details"
        rows={8}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        hint={FORMAT_HINT}
      />

      <MediaEditor
        idPrefix="ev"
        noun="event"
        existing={existing}
        onExistingChange={setExisting}
        pending={pending}
        onPendingChange={setPending}
        onProblem={setError}
        onDelete={(img) => {
          void ask({
            title: `Delete this ${MEDIA_LABEL[img.media_type].toLowerCase()}?`,
            message: "It will be removed from the event.",
            confirmLabel: "Yes, delete",
            tone: "danger",
          }).then((ok) => {
            if (!ok) return;
            void run(() => deleteEventPicture(img)).then((done) => {
              if (done)
                setExisting((list) => list.filter((m) => m.id !== img.id));
            });
          });
        }}
      />
      <CheckField id="ev-pub" checked={published} onChange={setPublished}>
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
