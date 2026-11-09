import { FileText, Play } from "lucide-react";
import { Photo } from "@/components/site/Photo";
import { mediaUrl, type EventMedia } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";
import { cn } from "@/lib/utils";

/** A small preview of an event picture, video (first frame) or PDF flier. */
export function MediaThumb({
  item,
  className,
}: {
  item: EventMedia;
  className?: string;
}) {
  if (item.media_type === "image") {
    return <Photo path={item.path} alt="" className={className} />;
  }

  if (item.media_type === "video") {
    const src = mediaUrl(item.path);
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-black",
          className,
        )}
      >
        {src && (
          // #t=0.1 makes browsers draw a frame to use as the picture; only metadata is fetched.
          <video
            src={`${src}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none h-full w-full object-cover"
          />
        )}
        <span
          aria-hidden="true"
          className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/40"
        >
          <Play className="ml-0.5 h-5 w-5 fill-current" />
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
