import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Share2,
  X,
} from "lucide-react";
import { MediaThumb } from "@/components/site/MediaThumb";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { Button, buttonVariants } from "@/components/ui/button";
import { mediaUrl, type EventMedia } from "@/lib/content";
import { MEDIA_LABEL, downloadName } from "@/lib/event-media";

/**
 * Full-screen viewer for event pictures, videos and PDF fliers. It has a Close button, a
 * Download button and a Share button. Escape closes it, the arrow keys (or a swipe) move
 * between files, and the page behind it does not scroll while it is open.
 */
export function MediaViewer({
  items,
  index,
  title,
  shareUrl,
  onIndexChange,
  onClose,
}: {
  items: EventMedia[];
  index: number;
  title: string;
  /** The link a friend receives for this file. */
  shareUrl: (item: EventMedia) => string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // A short "swipe" hint on phones the first time a set with several files opens.
  const [hint, setHint] = useState(items.length > 1);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 3500);
    return () => window.clearTimeout(t);
  }, [hint]);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= items.length) return;
      setHint(false);
      setShareOpen(false);
      setCopied(false);
      onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  // Lock page scroll, put focus on Close, and give focus back when the viewer goes away.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (shareOpen) setShareOpen(false);
        else onClose();
        return;
      }
      const typing =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLVideoElement;
      if (event.key === "ArrowLeft" && !typing) go(-1);
      if (event.key === "ArrowRight" && !typing) go(1);
      if (event.key === "Tab") {
        // Keep Tab inside the viewer.
        const focusable = rootRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, video[controls]",
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose, shareOpen]);

  if (!item) return null;

  const src = mediaUrl(item.path) ?? "";
  const fileName = downloadName(title, item, index + 1);
  const downloadHref = mediaUrl(item.path, { download: fileName }) ?? src;
  const link = shareUrl(item);
  const message = `${title} – i-Save`;

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: message, url: link });
        return;
      } catch (error) {
        // The person closed the share sheet: nothing more to do.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setShareOpen((open) => !open);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still selected in the box for the person to copy.
    }
  }

  function backdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).dataset.backdrop) onClose();
  }

  function touchEnd(event: TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const delta = event.changedTouches[0].clientX - start;
    if (Math.abs(delta) > 60) go(delta < 0 ? 1 : -1);
  }

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: ${MEDIA_LABEL[item.media_type]} ${index + 1} of ${items.length}`}
      className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={backdropClick}
    >
      <header
        data-backdrop="true"
        className="flex items-center gap-2 px-3 py-3 sm:px-5"
      >
        <div data-backdrop="true" className="min-w-0 flex-1 text-white">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-white/70">
            {MEDIA_LABEL[item.media_type]} {index + 1} of {items.length}
          </p>
        </div>

        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void share()}
            aria-haspopup="true"
            aria-expanded={shareOpen}
            aria-label="Share with friends"
          >
            <Share2 /> <span className="hidden sm:inline">Share</span>
          </Button>
          {shareOpen && (
            <div className="absolute right-0 z-10 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-2xl">
              <p className="mb-2 text-sm font-semibold">Share with friends</p>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${link}`)}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "default", size: "sm" }) + " w-full"}
              >
                <WhatsAppIcon className="h-4 w-4" /> Send on WhatsApp
              </a>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={link}
                  aria-label="Link to share"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                />
                <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <a
          href={downloadHref}
          download={fileName}
          aria-label="Download"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Download /> <span className="hidden sm:inline">Download</span>
        </a>

        <Button
          ref={closeRef}
          variant="secondary"
          size="sm"
          onClick={onClose}
          aria-label="Close"
        >
          <X /> <span className="hidden sm:inline">Close</span>
        </Button>
      </header>

      <div
        data-backdrop="true"
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
        onTouchStart={(e) => (swipeStart.current = e.touches[0].clientX)}
        onTouchEnd={touchEnd}
      >
        {index > 0 && (
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous"
            onClick={() => go(-1)}
            className="absolute left-2 z-10 rounded-full opacity-90"
          >
            <ChevronLeft />
          </Button>
        )}
        {index < items.length - 1 && (
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next"
            onClick={() => go(1)}
            className="absolute right-2 z-10 rounded-full opacity-90"
          >
            <ChevronRight />
          </Button>
        )}

        {item.media_type === "image" && (
          <img
            key={item.id}
            src={src}
            alt={item.caption ?? title}
            className="max-h-full max-w-full rounded-md object-contain"
          />
        )}
        {item.media_type === "video" && (
          <video
            key={item.id}
            src={src}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full rounded-md bg-black"
          />
        )}
        {item.media_type === "pdf" && (
          <iframe
            key={item.id}
            src={src}
            title={item.file_name ?? title}
            className="h-full w-full max-w-4xl rounded-md bg-white"
          />
        )}
      </div>

      <footer
        data-backdrop="true"
        className="px-4 py-3 text-center text-xs text-white/80"
      >
        {hint && (
          <p
            aria-hidden="true"
            className="mb-2 text-white/70 sm:hidden"
          >
            ← Swipe to see more →
          </p>
        )}
        {items.length > 1 && (
          <ul
            aria-label="All files"
            className="mx-auto mb-3 flex max-w-full justify-start gap-2 overflow-x-auto pb-1 sm:justify-center"
          >
            {items.map((m, i) => (
              <li key={m.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShareOpen(false);
                    setCopied(false);
                    onIndexChange(i);
                  }}
                  aria-label={`Show ${MEDIA_LABEL[m.media_type].toLowerCase()} ${i + 1} of ${items.length}`}
                  aria-current={i === index ? "true" : undefined}
                  className={`block overflow-hidden rounded-md ring-2 transition-opacity focus-visible:outline-none focus-visible:ring-white ${
                    i === index
                      ? "opacity-100 ring-white"
                      : "opacity-60 ring-transparent hover:opacity-100"
                  }`}
                >
                  <MediaThumb item={m} className="h-14 w-14 sm:h-16 sm:w-16" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {item.caption && <p className="mb-1 text-sm text-white">{item.caption}</p>}
        {item.media_type === "pdf" && (
          <p>
            Can’t see the flier?{" "}
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4"
            >
              Open it in a new tab <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
      </footer>
    </div>,
    document.body,
  );
}
