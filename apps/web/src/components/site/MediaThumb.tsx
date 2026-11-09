import { FileText, Play } from "lucide-react";
import { Photo } from "@/components/site/Photo";
import { mediaUrl, type EventMedia } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";
import { cn } from "@/lib/utils";

/** A small preview of an event picture, video (play button) or PDF flier. */
export function MediaThumb({
  item,
  className,
  backdrop = false,
}: {
  item: EventMedia;
  className?: string;
  /** Show the whole picture on a soft blurred copy of itself, so nothing is cropped. */
  backdrop?: boolean;
}) {
  if (item.media_type === "image") {
    const src = mediaUrl(item.path);
    if (backdrop && src) {
      return (
        <div className={cn("relative overflow-hidden bg-muted", className)}>
          <img
            src={src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
          />
          <img
            src={src}
            alt=""
            loading="lazy"
            className="relative h-full w-full object-contain"
          />
        </div>
      );
    }
    return <Photo path={item.path} alt="" className={className} />;
  }

  if (item.media_type === "video") {
    // No video is downloaded just to draw a picture: on mobile data a video can be 50 MB.
    // It loads only when someone taps it and the viewer opens.
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 to-black",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg"
        >
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white uppercase">
          {MEDIA_LABEL.video}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 bg-muted p-3 text-center text-muted-foreground",
        className,
      )}
    >
      <FileText aria-hidden="true" className="h-9 w-9 text-primary" />
      <span className="line-clamp-2 max-w-full text-xs break-words">
        {item.file_name ?? "Flier"}
      </span>
      <span className="rounded bg-background/70 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
        {MEDIA_LABEL.pdf}
      </span>
    </div>
  );
}
