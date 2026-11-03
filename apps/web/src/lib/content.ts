import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { MEDIA_BUCKET, newImagePath, shrinkImage } from "@/lib/images";

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
});
export type Announcement = z.infer<typeof AnnouncementRow>;

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

const ImageRow = z.object({
  id: z.string(),
  path: z.string(),
  caption: z.string().nullable(),
  sort_order: z.number(),
});
export type EventImage = z.infer<typeof ImageRow>;

const EventRow = z.object({
  id: z.string(),
  title: z.string(),
  event_date: z.string(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  details: z.string().nullable(),
  published: z.boolean(),
  event_images: z.array(ImageRow),
});
export type SiteEvent = Omit<z.infer<typeof EventRow>, "event_images"> & {
  images: EventImage[];
};

const FAQ_COLUMNS = "id, question, answer, sort_order, published";
const ANNOUNCEMENT_COLUMNS =
  "id, title, body, published, published_at, send_email, send_whatsapp, sent_at, recipients_in_app, recipients_email, recipients_whatsapp, created_at";
const TEAM_COLUMNS =
  "id, full_name, role_title, bio, photo_path, level, sort_order, published";
const EVENT_COLUMNS =
  "id, title, event_date, location, summary, details, published, event_images(id, path, caption, sort_order)";

/** Public address of an uploaded picture. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
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

async function fetchAnnouncements(
  all: boolean,
  limit?: number,
): Promise<Announcement[]> {
  let q = supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (!all) q = q.eq("published", true);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return z.array(AnnouncementRow).parse(data);
}
export const useAnnouncements = (all = false, limit?: number) =>
  useQuery({
    queryKey: ["content", "announcements", all, limit ?? null],
    queryFn: () => fetchAnnouncements(all, limit),
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

function toEvent(row: z.infer<typeof EventRow>): SiteEvent {
  const { event_images, ...rest } = row;
  return {
    ...rest,
    images: [...event_images].sort((a, b) => a.sort_order - b.sort_order),
  };
}

async function fetchEvents(all: boolean, limit?: number): Promise<SiteEvent[]> {
  let q = supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .order("event_date", { ascending: false });
  if (!all) q = q.eq("published", true);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return z.array(EventRow).parse(data).map(toEvent);
}
export const useEvents = (all = false, limit?: number) =>
  useQuery({
    queryKey: ["content", "events", all, limit ?? null],
    queryFn: () => fetchEvents(all, limit),
  });

async function fetchEvent(id: string): Promise<SiteEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? toEvent(EventRow.parse(data)) : null;
}
export const useEvent = (id: string) =>
  useQuery({
    queryKey: ["content", "event", id],
    queryFn: () => fetchEvent(id),
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
export async function deleteAnnouncement(id: string) {
  check((await supabase.from("announcements").delete().eq("id", id)).error);
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

async function uploadPicture(folder: string, file: File): Promise<string> {
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
async function removePictures(paths: Array<string | null | undefined>) {
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
export async function saveTeamMember(
  values: TeamValues,
  opts: { id?: string; photo?: File | null; oldPhotoPath?: string | null },
) {
  const photo_path = opts.photo
    ? await uploadPicture("team", opts.photo)
    : undefined;
  const row = photo_path ? { ...values, photo_path } : values;
  const { error } = opts.id
    ? await supabase.from("team_members").update(row).eq("id", opts.id)
    : await supabase.from("team_members").insert(row);
  if (error) {
    await removePictures([photo_path]);
    throw error;
  }
  if (photo_path) await removePictures([opts.oldPhotoPath]);
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
export async function addEventPictures(
  eventId: string,
  files: File[],
  startOrder: number,
) {
  let order = startOrder;
  for (const file of files) {
    const path = await uploadPicture(`events/${eventId}`, file);
    const { error } = await supabase
      .from("event_images")
      .insert({ event_id: eventId, path, sort_order: (order += 10) });
    if (error) {
      await removePictures([path]);
      throw error;
    }
  }
}
export async function deleteEventPicture(image: EventImage) {
  check(
    (await supabase.from("event_images").delete().eq("id", image.id)).error,
  );
  await removePictures([image.path]);
}
