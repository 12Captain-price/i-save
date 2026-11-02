import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/staff/AdminOnly";
import {
  ErrorLine,
  PageHeading,
  TextAreaField,
} from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import {
  deleteAnnouncement,
  markWhatsappSent,
  saveAnnouncement,
  sendAnnouncement,
  useAnnouncements,
  useWhatsappOutbox,
  whatsappLink,
  type Announcement,
} from "@/lib/content";
import { formatDateTime } from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/announcements")({
  component: () => (
    <AdminOnly title="Announcements">
      <AnnouncementsAdmin />
    </AdminOnly>
  ),
});

function AnnouncementsAdmin() {
  const { data, isPending, isError } = useAnnouncements(true);
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const { run, busy, error } = useContentAction();
  const [notice, setNotice] = useState<string | null>(null);

  async function send(a: Announcement) {
    const channels = [
      a.send_email && "email",
      a.send_whatsapp && "WhatsApp",
      "the app",
    ]
      .filter(Boolean)
      .join(", ");
    if (
      !window.confirm(
        `Send "${a.title}" to all active members by ${channels}? This cannot be undone.`,
      )
    )
      return;
    setNotice(null);
    let summary = "";
    const ok = await run(async () => {
      const r = await sendAnnouncement(a.id);
      summary = `Sent. In the app: ${r.in_app}. Email queued: ${r.email}. WhatsApp waiting in the outbox: ${r.whatsapp}.`;
    });
    if (ok) setNotice(summary);
  }

  return (
    <div>
      <PageHeading
        title="Announcements"
        lead="Write a notice, publish it on the website, then send it to members. Email goes out automatically; WhatsApp messages wait in the outbox below for you to send."
      />
      <div className="mt-6">
        <Button onClick={() => setEditing("new")}>New announcement</Button>
      </div>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-md border border-border bg-card p-4 text-sm"
        >
          {notice}
        </p>
      )}
      <div className="mt-4">
        <ErrorLine message={error} />
      </div>

      <div className="mt-6 grid gap-4">
        {editing === "new" && (
          <AnnouncementForm initial={null} onDone={() => setEditing(null)} />
        )}
        {isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {isError && <ErrorLine message="Announcements could not be loaded." />}
        {data?.map((a) =>
          editing && editing !== "new" && editing.id === a.id ? (
            <AnnouncementForm
              key={a.id}
              initial={a}
              onDone={() => setEditing(null)}
            />
          ) : (
            <div key={a.id} className="rounded-md border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{a.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.sent_at
                      ? `Sent ${formatDateTime(a.sent_at)} · app ${a.recipients_in_app ?? 0}, email ${a.recipients_email ?? 0}, WhatsApp ${a.recipients_whatsapp ?? 0}`
                      : a.published
                        ? "Published on the website, not sent to members yet"
                        : "Draft (not on the website)"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {a.body}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!a.sent_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(a)}
                    >
                      Edit
                    </Button>
                  )}
                  {!a.sent_at && a.published && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void send(a)}
                    >
                      Send to members
                    </Button>
                  )}
                  {a.sent_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          saveAnnouncement(
                            {
                              title: a.title,
                              body: a.body,
                              published: !a.published,
                              send_email: a.send_email,
                              send_whatsapp: a.send_whatsapp,
                            },
                            a.id,
                          ),
                        )
                      }
                    >
                      {a.published ? "Hide from website" : "Show on website"}
                    </Button>
                  )}
                  {!a.sent_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm("Delete this announcement?"))
                          void run(() => deleteAnnouncement(a.id));
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <Outbox />
    </div>
  );
}

function AnnouncementForm({
  initial,
  onDone,
}: {
  initial: Announcement | null;
  onDone: () => void;
}) {
  const { run, busy, error } = useContentAction();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [email, setEmail] = useState(initial?.send_email ?? true);
  const [whatsapp, setWhatsapp] = useState(initial?.send_whatsapp ?? true);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const ok = await run(() =>
      saveAnnouncement(
        {
          title: title.trim(),
          body,
          published,
          send_email: email,
          send_whatsapp: whatsapp,
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
        id="an-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextAreaField
        id="an-body"
        label="Message"
        rows={7}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint="Keep it short and plain. The same text goes on the website, in members’ messages, by email and on WhatsApp."
      />
      <CheckField id="an-pub" checked={published} onChange={setPublished}>
        Show on the website (required before you can send it)
      </CheckField>
      <CheckField id="an-email" checked={email} onChange={setEmail}>
        When sent, email members who allow email
      </CheckField>
      <CheckField id="an-wa" checked={whatsapp} onChange={setWhatsapp}>
        When sent, queue WhatsApp messages for members who opted in
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

/** Queued WhatsApp announcement messages. Staff open each chat, press send, then mark it sent. */
function Outbox() {
  const { data, isPending, isError } = useWhatsappOutbox();
  const { run, busy, error } = useContentAction();
  return (
    <section className="mt-12" aria-labelledby="outbox-title">
      <h2 id="outbox-title" className="text-xl font-semibold">
        WhatsApp outbox
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        These members opted in to WhatsApp. Press “Open WhatsApp”, send the
        message, then press “Mark sent”. Automatic WhatsApp sending needs a
        WhatsApp Business account and can be added later.
      </p>
      <div className="mt-3">
        <ErrorLine message={error} />
      </div>
      {isPending && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {isError && <ErrorLine message="The outbox could not be loaded." />}
      {data?.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Nothing waiting.</p>
      )}
      {data && data.length > 0 && (
        <>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Mark all ${data.length} as sent?`))
                  void run(() => markWhatsappSent(data.map((d) => d.id)));
              }}
            >
              Mark all {data.length} as sent
            </Button>
          </div>
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {data.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.profiles?.full_name ?? "Member"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.profiles?.phone ?? "No phone number"} · {item.subject}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.profiles?.phone && (
                    <a
                      className="inline-flex min-h-9 items-center rounded-md border border-input px-3 text-xs font-semibold"
                      href={whatsappLink(
                        item.profiles.phone,
                        item.subject ?? "i-Save",
                        item.body,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WhatsApp
                    </a>
                  )}
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => markWhatsappSent([item.id]))}
                  >
                    Mark sent
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
