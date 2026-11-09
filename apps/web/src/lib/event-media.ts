// Events can hold pictures, short videos and PDF fliers. Pictures are shrunk in the browser
// (see images.ts); videos and PDFs are uploaded as they are, so they have size limits instead.

import { checkImageFile } from "@/lib/images";

export type MediaKind = "image" | "video" | "pdf";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export const EVENT_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf";

const VIDEO_TYPES = ["video/mp4", "video/webm"];

/** What kind of media a file is, or null if it is not one we accept. */
export function mediaKindOf(file: { type: string }): MediaKind | null {
  if (file.type === "application/pdf") return "pdf";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  if (checkImageFile({ type: file.type, size: 0 }) === null) return "image";
  return null;
}

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** A plain-words message if the file cannot be used, otherwise null. */
export function checkEventFile(file: {
  type: string;
  size: number;
}): string | null {
  const kind = mediaKindOf(file);
  if (!kind) {
    return "Please choose a JPG, PNG or WebP picture, an MP4 or WebM video, or a PDF.";
  }
  if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
    return `That video is too large (limit ${mb(MAX_VIDEO_BYTES)} MB). Trim or compress it and try again.`;
  }
  if (kind === "pdf" && file.size > MAX_PDF_BYTES) {
    return `That PDF is too large (limit ${mb(MAX_PDF_BYTES)} MB).`;
  }
  return null;
}

export function extensionOf(path: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match ? match[1].toLowerCase() : "";
}

/** Storage path for a video or PDF, keeping the right extension. */
export function mediaExtension(file: { type: string; name: string }): string {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/mp4") return "mp4";
  return extensionOf(file.name) || "bin";
}

/** A safe file name for the Download button, e.g. "agm-2026-flier.pdf". */
export function downloadName(
  title: string,
  item: { path: string; file_name: string | null; media_type: MediaKind },
  position: number,
): string {
  const ext = extensionOf(item.path) || "jpg";
  if (item.file_name && item.media_type !== "image") {
    const clean = item.file_name.replace(/[^A-Za-z0-9._ -]/g, "").trim();
    if (clean) return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
  }
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "event";
  return `${slug}-${position}.${ext}`;
}

export const MEDIA_LABEL: Record<MediaKind, string> = {
  image: "Picture",
  video: "Video",
  pdf: "PDF",
};
