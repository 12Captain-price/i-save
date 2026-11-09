import { useEffect, useRef, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Share button for a notice or event. On phones it opens the phone's own share sheet; where
 * that does not exist (most computers) it opens a small box with "Send on WhatsApp" and
 * "Copy link".
 */
export function ShareButton({
  title,
  url,
  className,
  iconOnly = false,
}: {
  title: string;
  /** The full link a friend receives. */
  url: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const message = `${title} – i-Save`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: message, url });
        return;
      } catch (error) {
        // The person closed the share sheet: nothing more to do.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is selectable in the box for the person to copy.
    }
  }

  return (
    <div ref={box} className={cn("relative inline-block", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void share()}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Share: ${title}`}
      >
        <Share2 />
        {!iconOnly && <span>Share</span>}
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <p className="mb-2 text-sm font-semibold">Share with friends</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "w-full",
            )}
          >
            <WhatsAppIcon className="h-4 w-4" /> Send on WhatsApp
          </a>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={url}
              aria-label="Link to share"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button variant="outline" size="sm" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
