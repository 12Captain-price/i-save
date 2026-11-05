import { mediaUrl } from "@/lib/content";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** A stored picture, or the person's initials when there is no picture yet. */
export function Photo({
  path,
  alt,
  fallbackName,
  className,
}: {
  path: string | null;
  alt: string;
  fallbackName?: string;
  className?: string;
}) {
  const src = mediaUrl(path);
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground",
          className,
        )}
      >
        {fallbackName ? initials(fallbackName) : ""}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("bg-muted object-contain", className)}
    />
  );
}
