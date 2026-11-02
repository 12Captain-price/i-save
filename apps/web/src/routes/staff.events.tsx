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
import { Photo } from "@/components/site/Photo";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import {
  addEventPictures,
  deleteEvent,
  deleteEventPicture,
  saveEvent,
  useEvents,
  type SiteEvent,
} from "@/lib/content";
import { checkImageFile } from "@/lib/images";
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
        {isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        )}
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
                path={ev.images[0]?.path ?? null}
                alt=""
                className="h-16 w-24 rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(ev.event_date)} · {ev.images.length} picture
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
                    if (
                      window.confirm(`Delete "${ev.title}" and its pictures?`)
                    )
                      void run(() => deleteEvent(ev));
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
  const { run, busy, error, setError } = useContentAction();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(
    initial?.event_date ?? new Date().toISOString().slice(0, 10),
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [files, setFiles] = useState<File[]>([]);

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    const bad = chosen.map(checkImageFile).find(Boolean);
    if (bad) {
      setError(bad);
      return;
    }
    setError(null);
    setFiles(chosen);
  }

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
      if (files.length) {
        const last = initial?.images.at(-1)?.sort_order ?? 0;
        await addEventPictures(id, files, last);
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

      {initial && initial.images.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Pictures</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {initial.images.map((img) => (
              <li key={img.id} className="text-center">
                <Photo
                  path={img.path}
                  alt=""
                  className="aspect-[4/3] w-full rounded"
                />
                <button
                  type="button"
                  className="mt-1 text-xs text-destructive underline"
                  onClick={() => {
                    if (window.confirm("Delete this picture?"))
                      void run(() => deleteEventPicture(img));
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <label htmlFor="ev-files" className="mb-1.5 block text-sm font-medium">
          Add pictures
        </label>
        <input
          id="ev-files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => pick(e.target.files)}
          className="text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {files.length
            ? `${files.length} selected. They upload when you press Save.`
            : "You can choose several at once. Large photos are shrunk automatically."}
        </p>
      </div>
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
