import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { MEDIA_BUCKET, newImagePath, shrinkImage } from "@/lib/images";
import {
  checkEventFile,
  mediaExtension,
  mediaKindOf,
  type MediaKind,
} from "@/lib/event-media";

// Public site content (pages, FAQs, announcements, team, events). Visitors can read only what
// is published; admins can read and write everything. The database enforces both rules.

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

const PageRow = z.object({
  key: z.enum(["terms", "privacy", "disclosures"]),
  title: z.string(),
  body: z.string(),
  published: z.boolean(),
  updated_at: z.string(),
});
export type SitePage = z.infer<typeof PageRow>;

const FaqRow = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  sort_order: z.number(),
  published: z.boolean(),
});
export type Faq = z.infer<typeof FaqRow>;

// One picture, video or PDF attached to an event (table: event_images) or to an announcement
// (table: announcement_files). Both tables have the same columns.
const MediaRow = z.object({
  id: z.string(),
  path: z.string(),
  caption: z.string().nullable(),
  sort_order: z.number(),
  media_type: z.enum(["image", "video", "pdf"]).default("image"),
  file_name: z.string().nullable().default(null),
});

const AnnouncementRow = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  published: z.boolean(),
  published_at: z.string().nullable(),
  send_email: z.boolean(),
  send_whatsapp: z.boolean(),
  sent_at: z.string().nullable(),
  recipients_in_app: z.number().nullable(),
  recipients_email: z.number().nullable(),
  recipients_whatsapp: z.number().nullable(),
  created_at: z.string(),
  announcement_files: z.array(MediaRow).default([]),
});
export type Announcement = Omit<
  z.infer<typeof AnnouncementRow>,
  "announcement_files"
> & { files: EventMedia[] };

const TeamRow = z.object({
  id: z.string(),
  full_name: z.string(),
  role_title: z.string(),
  bio: z.string().nullable(),
  photo_path: z.string().nullable(),
  level: z.number(),
  sort_order: z.number(),
  published: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamRow>;

const TeamContactRow = z.object({
  member_id: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  show_on_contact: z.boolean(),
});
export type TeamContact = z.infer<typeof TeamContactRow>;

export type EventImage = z.infer<typeof MediaRow>;
export type EventMedia = EventImage;

const EventRow = z.object({
  id: z.string(),
  title: z.string(),
  event_date: z.string(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  details: z.string().nullable(),
  published: z.boolean(),
  published_at: z.string().nullable().default(null),
  event_images: z.array(MediaRow),
});
export type SiteEvent = Omit<z.infer<typeof EventRow>, "event_images"> & {
  images: EventImage[];
};

const FAQ_COLUMNS = "id, question, answer, sort_order, published";
const MEDIA_FIELDS = "id, path, caption, sort_order, media_type, file_name";
const ANNOUNCEMENT_BASE =
  "id, title, body, published, published_at, send_email, send_whatsapp, sent_at, recipients_in_app, recipients_email, recipients_whatsapp, created_at";
const ANNOUNCEMENT_COLUMNS = `${ANNOUNCEMENT_BASE}, announcement_files(${MEDIA_FIELDS})`;
const TEAM_COLUMNS =
  "id, full_name, role_title, bio, photo_path, level, sort_order, published";
const EVENT_BASE =
  "id, title, event_date, location, summary, details, published";
const EVENT_COLUMNS = `${EVENT_BASE}, published_at, event_images(${MEDIA_FIELDS})`;

/**
 * The site is deployed before the database change (migration 029) is always run. If the new
 * columns or table are missing, ask again for the old columns so the pages keep working.
 */
function isMissingNewColumns(error: {
  code?: string;
  message?: string;
}): boolean {
  const text = `${error.code ?? ""} ${error.message ?? ""}`;
  return (
    /42703|PGRST200|PGRST204|PGRST205|42P01/.test(text) ||
    /published_at|announcement_files/.test(text)
  );
}

/**
 * Public address of an uploaded file. With `download`, the address makes the browser save the
 * file under that name instead of showing it (this works across sites, unlike the HTML
 * download attribute).
 */
export function mediaUrl(
  path: string | null | undefined,
  opts?: { download?: string },
): string | null {
  if (!path) return null;
  return supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(
      path,
      opts?.download ? { download: opts.download } : undefined,
    ).data.publicUrl;
}

/** The picture to show as an event's cover: the first picture (videos and PDFs have no cover). */
export function eventCoverPath(event: SiteEvent): string | null {
  return event.images.find((m) => m.media_type === "image")?.path ?? null;
}

/* ------------------------------------------------------------------ */
/* Reading. `all` is for staff screens and includes unpublished rows.  */
/* ------------------------------------------------------------------ */

async function fetchPage(key: string): Promise<SitePage | null> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("key, title, body, published, updated_at")
    .eq("key", key)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? PageRow.parse(data) : null;
}
export const usePage = (key: SitePage["key"]) =>
  useQuery({
    queryKey: ["content", "page", key],
    queryFn: () => fetchPage(key),
  });

async function fetchAllPages(): Promise<SitePage[]> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("key, title, body, published, updated_at")
    .order("key");
  if (error) throw error;
  return z.array(PageRow).parse(data);
}
export const useAllPages = () =>
  useQuery({ queryKey: ["content", "pages-all"], queryFn: fetchAllPages });

async function fetchFaqs(all: boolean): Promise<Faq[]> {
  let q = supabase
    .from("faqs")
    .select(FAQ_COLUMNS)
    .order("sort_order")
    .order("created_at");
  if (!all) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return z.array(FaqRow).parse(data);
}
export const useFaqs = (all = false) =>
  useQuery({
    queryKey: ["content", "faqs", all],
    queryFn: () => fetchFaqs(all),
  });

function toAnnouncement(row: z.infer<typeof AnnouncementRow>): Announcement {
  const { announcement_files, ...rest } = row;
  return {
    ...rest,
    files: [...announcement_files].sort((a, b) => a.sort_order - b.sort_order),
  };
}

async function fetchAnnouncements(
  all: boolean,
  limit?: number,
): Promise<Announcement[]> {
  const run = async (columns: string) => {
    let q = supabase
      .from("announcements")
      .select(columns)
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false });
    if (!all) q = q.eq("published", true);
    if (limit) q = q.limit(limit);
    return q;
  };
  let { data, error } = await run(ANNOUNCEMENT_COLUMNS);
  if (error && isMissingNewColumns(error)) {
    ({ data, error } = await run(ANNOUNCEMENT_BASE));
  }
  if (error) throw error;
  return z.array(AnnouncementRow).parse(data).map(toAnnouncement);
}
export const useAnnouncements = (all = false, limit?: number) =>
  useQuery({
    queryKey: ["content", "announcements", all, limit ?? null],
    queryFn: () => fetchAnnouncements(all, limit),
  });

async function fetchAnnouncement(id: string): Promise<Announcement | null> {
  const run = (columns: string) =>
    supabase
      .from("announcements")
      .select(columns)
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();
  let { data, error } = await run(ANNOUNCEMENT_COLUMNS);
  if (error && isMissingNewColumns(error)) {
    ({ data, error } = await run(ANNOUNCEMENT_BASE));
  }
  if (error) throw error;
  return data ? toAnnouncement(AnnouncementRow.parse(data)) : null;
}
export const useAnnouncement = (id: string) =>
  useQuery({
    queryKey: ["content", "announcement", id],
    queryFn: () => fetchAnnouncement(id),
  });

async function fetchTeam(all: boolean): Promise<TeamMember[]> {
  let q = supabase
    .from("team_members")
    .select(TEAM_COLUMNS)
    .order("level")
    .order("sort_order")
    .order("full_name");
  if (!all) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return z.array(TeamRow).parse(data);
}
export const useTeam = (all = false) =>
  useQuery({
    queryKey: ["content", "team", all],
    queryFn: () => fetchTeam(all),
  });

/**
 * Phone and email of team members. Visitors only ever receive the ones staff ticked "Show on
 * the Contact page" for (the database enforces this); staff (all = true) receive every row.
 * If migration 030 has not been run yet, the public Contact page simply shows no team.
 */
async function fetchTeamContacts(all: boolean): Promise<TeamContact[]> {
  const { data, error } = await supabase
    .from("team_contact_details")
    .select("member_id, phone, email, show_on_contact");
  if (error) {
    if (all) throw error;
    return [];
  }
  return z.array(TeamContactRow).parse(data);
}
export const useTeamContacts = (all = false) =>
  useQuery({
    queryKey: ["content", "team-contacts", all],
    queryFn: () => fetchTeamContacts(all),
  });

function toEvent(row: z.infer<typeof EventRow>): SiteEvent {
  const { event_images, ...rest } = row;
  return {
    ...rest,
    images: [...event_images].sort((a, b) => a.sort_order - b.sort_order),
  };
}

async function fetchEvents(all: boolean, limit?: number): Promise<SiteEvent[]> {
  const run = (columns: string) => {
    let q = supabase
      .from("events")
      .select(columns)
      .order("event_date", { ascending: false });
    if (!all) q = q.eq("published", true);
    if (limit) q = q.limit(limit);
    return q;
  };
  let { data, error } = await run(EVENT_COLUMNS);
  if (error && isMissingNewColumns(error)) {
    ({ data, error } = await run(
      `${EVENT_BASE}, event_images(${MEDIA_FIELDS})`,
    ));
  }
  if (error) throw error;
  return z.array(EventRow).parse(data).map(toEvent);
}
export const useEvents = (all = false, limit?: number) =>
  useQuery({
    queryKey: ["content", "events", all, limit ?? null],
    queryFn: () => fetchEvents(all, limit),
  });

async function fetchEvent(id: string): Promise<SiteEvent | null> {
  const run = (columns: string) =>
    supabase
      .from("events")
      .select(columns)
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();
  let { data, error } = await run(EVENT_COLUMNS);
  if (error && isMissingNewColumns(error)) {
    ({ data, error } = await run(
      `${EVENT_BASE}, event_images(${MEDIA_FIELDS})`,
    ));
  }
  if (error) throw error;
  return data ? toEvent(EventRow.parse(data)) : null;
}
export const useEvent = (id: string) =>
  useQuery({
    queryKey: ["content", "event", id],
    queryFn: () => fetchEvent(id),
  });

/**
 * Just the dates, for the header badges. Cheap on purpose: no text, no files.
 * Returns nothing (rather than an error) if the publish dates are not in the database yet.
 */
async function fetchFeedDates(): Promise<{
  announcements: Array<{ published_at: string | null }>;
  events: Array<{ published_at: string | null }>;
}> {
  const pick = async (table: "announcements" | "events") => {
    const { data, error } = await supabase
      .from(table)
      .select("published_at")
      .eq("published", true)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(30);
    if (error) return [];
    return z
      .array(z.object({ published_at: z.string().nullable() }))
      .parse(data);
  };
  const [announcements, events] = await Promise.all([
    pick("announcements"),
    pick("events"),
  ]);
  return { announcements, events };
}
export const useFeedDates = () =>
  useQuery({
    queryKey: ["content", "feed-dates"],
    queryFn: fetchFeedDates,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

/* ------------------------------------------------------------------ */
/* Changes (admins only). Each throws on failure; the screen shows it. */
/* ------------------------------------------------------------------ */

function check(error: { message: string } | null) {
  if (error) throw error;
}

export async function savePage(
  key: SitePage["key"],
  values: { title: string; body: string; published: boolean },
) {
  const { error } = await supabase
    .from("site_pages")
    .update(values)
    .eq("key", key);
  check(error);
}

export type FaqValues = {
  question: string;
  answer: string;
  sort_order: number;
  published: boolean;
};
export async function saveFaq(values: FaqValues, id?: string) {
  const { error } = id
    ? await supabase.from("faqs").update(values).eq("id", id)
    : await supabase.from("faqs").insert(values);
  check(error);
}
export async function deleteFaq(id: string) {
  check((await supabase.from("faqs").delete().eq("id", id)).error);
}

export type AnnouncementValues = {
  title: string;
  body: string;
  published: boolean;
  send_email: boolean;
  send_whatsapp: boolean;
};
export async function saveAnnouncement(
  values: AnnouncementValues,
  id?: string,
) {
  const { error } = id
    ? await supabase.from("announcements").update(values).eq("id", id)
    : await supabase.from("announcements").insert(values);
  check(error);
}
/** Returns the announcement id, so files can be added straight after creating it. */
export async function createAnnouncement(
  values: AnnouncementValues,
): Promise<string> {
  const { data, error } = await supabase
    .from("announcements")
    .insert(values)
    .select("id")
    .single();
  check(error);
  return (data as { id: string }).id;
}
export async function deleteAnnouncement(
  a: Pick<Announcement, "id" | "files">,
) {
  check((await supabase.from("announcements").delete().eq("id", a.id)).error);
  await removePictures(a.files.map((f) => f.path));
}

export type SendResult = { in_app: number; email: number; whatsapp: number };
export async function sendAnnouncement(id: string): Promise<SendResult> {
  const { data, error } = await supabase.rpc("send_announcement", { p_id: id });
  check(error);
  return z
    .object({ in_app: z.number(), email: z.number(), whatsapp: z.number() })
    .parse(data);
}

/* WhatsApp outbox: queued announcement messages that staff send by hand. */

const OutboxRow = z.object({
  id: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  profiles: z
    .object({ full_name: z.string(), phone: z.string().nullable() })
    .nullable(),
});
export type OutboxItem = z.infer<typeof OutboxRow>;

async function fetchOutbox(): Promise<OutboxItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, subject, body, profiles(full_name, phone)")
    .eq("channel", "whatsapp")
    .eq("event", "announcement")
    .eq("status", "queued")
    .order("created_at")
    .limit(500);
  if (error) throw error;
  return z.array(OutboxRow).parse(data);
}
export const useWhatsappOutbox = () =>
  useQuery({ queryKey: ["content", "outbox"], queryFn: fetchOutbox });

export async function markWhatsappSent(ids: string[]) {
  check((await supabase.rpc("mark_whatsapp_sent", { p_ids: ids })).error);
}

/** Throws away queued WhatsApp messages that will never be sent. Admins only. */
export async function discardWhatsappOutbox(ids: string[]) {
  check((await supabase.rpc("discard_whatsapp_outbox", { p_ids: ids })).error);
}

/** wa.me link that opens WhatsApp with the message ready to send. */
export function whatsappLink(
  phone: string,
  title: string,
  body: string,
): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(`*${title}*\n\n${body}`)}`;
}

/* Pictures */

export async function uploadPicture(
  folder: string,
  file: File,
): Promise<string> {
  const blob = await shrinkImage(file);
  const path = newImagePath(folder);
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
  check(error);
  return path;
}
export async function removePictures(paths: Array<string | null | undefined>) {
  const real = paths.filter((p): p is string => Boolean(p));
  if (real.length) await supabase.storage.from(MEDIA_BUCKET).remove(real);
}

export type TeamValues = {
  full_name: string;
  role_title: string;
  bio: string | null;
  level: number;
  sort_order: number;
  published: boolean;
};
export type TeamContactValues = {
  phone: string | null;
  email: string | null;
  show_on_contact: boolean;
};
export async function saveTeamMember(
  values: TeamValues,
  opts: {
    id?: string;
    photo?: File | null;
    oldPhotoPath?: string | null;
    contact?: TeamContactValues;
    /** True when this person already has a contact row, so clearing it is saved too. */
    hadContact?: boolean;
  },
) {
  const photo_path = opts.photo
    ? await uploadPicture("team", opts.photo)
    : undefined;
  const row = photo_path ? { ...values, photo_path } : values;
  let memberId = opts.id;
  let error;
  if (opts.id) {
    ({ error } = await supabase
      .from("team_members")
      .update(row)
      .eq("id", opts.id));
  } else {
    const res = await supabase
      .from("team_members")
      .insert(row)
      .select("id")
      .single();
    error = res.error;
    memberId = res.data?.id;
  }
  if (error) {
    await removePictures([photo_path]);
    throw error;
  }
  if (photo_path) await removePictures([opts.oldPhotoPath]);

  const c = opts.contact;
  if (c && memberId && (opts.hadContact || c.phone || c.email || c.show_on_contact)) {
    check(
      (
        await supabase
          .from("team_contact_details")
          .upsert({ member_id: memberId, ...c }, { onConflict: "member_id" })
      ).error,
    );
  }
}
export async function deleteTeamMember(member: TeamMember) {
  check(
    (await supabase.from("team_members").delete().eq("id", member.id)).error,
  );
  await removePictures([member.photo_path]);
}

export type EventValues = {
  title: string;
  event_date: string;
  location: string | null;
  summary: string | null;
  details: string | null;
  published: boolean;
};
/** Returns the event id, so pictures can be added straight after creating it. */
export async function saveEvent(
  values: EventValues,
  id?: string,
): Promise<string> {
  if (id) {
    check((await supabase.from("events").update(values).eq("id", id)).error);
    return id;
  }
  const { data, error } = await supabase
    .from("events")
    .insert(values)
    .select("id")
    .single();
  check(error);
  return (data as { id: string }).id;
}
export async function deleteEvent(event: SiteEvent) {
  check((await supabase.from("events").delete().eq("id", event.id)).error);
  await removePictures(event.images.map((i) => i.path));
}
/* Files on events and announcements */

export type MediaTable = "event_images" | "announcement_files";
const PARENT_COLUMN: Record<MediaTable, string> = {
  event_images: "event_id",
  announcement_files: "announcement_id",
};
const FOLDER: Record<MediaTable, string> = {
  event_images: "events",
  announcement_files: "announcements",
};

/** A file waiting to be uploaded, with the caption typed for it. */
export type PendingFile = { file: File; caption: string };

/** Pictures are shrunk first; videos and PDFs go up exactly as they are. */
async function uploadMediaFile(
  folder: string,
  file: File,
): Promise<{ path: string; media_type: MediaKind; file_name: string | null }> {
  const problem = checkEventFile(file);
  if (problem) throw new Error(problem);
  const kind = mediaKindOf(file);
  if (!kind) throw new Error("That file type is not supported.");
  if (kind === "image") {
    const path = await uploadPicture(folder, file);
    return { path, media_type: "image", file_name: null };
  }
  const path = newImagePath(folder, mediaExtension(file));
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  check(error);
  return { path, media_type: kind, file_name: file.name };
}

export async function addMedia(
  table: MediaTable,
  parentId: string,
  files: PendingFile[],
  startOrder: number,
) {
  let order = startOrder;
  for (const { file, caption } of files) {
    const uploaded = await uploadMediaFile(
      `${FOLDER[table]}/${parentId}`,
      file,
    );
    const { error } = await supabase.from(table).insert({
      [PARENT_COLUMN[table]]: parentId,
      ...uploaded,
      caption: caption.trim() || null,
      sort_order: (order += 10),
    });
    if (error) {
      await removePictures([uploaded.path]);
      throw error;
    }
  }
}

export async function deleteMedia(table: MediaTable, item: EventMedia) {
  check((await supabase.from(table).delete().eq("id", item.id)).error);
  await removePictures([item.path]);
}

/** Saves the captions and the order shown in the admin form (position 1 is first). */
export async function saveMediaDetails(
  table: MediaTable,
  items: Array<{ id: string; caption: string | null }>,
) {
  for (const [i, item] of items.entries()) {
    const { error } = await supabase
      .from(table)
      .update({
        caption: item.caption?.trim() || null,
        sort_order: (i + 1) * 10,
      })
      .eq("id", item.id);
    check(error);
  }
}

export const addEventMedia = (
  eventId: string,
  files: PendingFile[],
  startOrder: number,
) => addMedia("event_images", eventId, files, startOrder);
export const deleteEventPicture = (image: EventImage) =>
  deleteMedia("event_images", image);
