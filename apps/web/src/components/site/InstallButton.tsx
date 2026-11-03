import { useState } from "react";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useInstall } from "@/lib/install";
import { cn } from "@/lib/utils";

/**
 * One clear "Install app" button. Where the browser allows it, it opens the browser's own
 * install dialog. On iPhone (and any browser that does not offer one) it shows the short
 * steps instead. It hides itself once the site is already installed.
 */
export function InstallButton({
  className,
  size = "sm",
  variant = "outline",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline";
}) {
  const { installed, ios, canPrompt, prompt } = useInstall();
  const [help, setHelp] = useState(false);

  if (installed) return null;

  return (
    <div className="relative inline-block print:hidden">
      <button
        type="button"
        className={cn(buttonVariants({ size, variant }), className)}
        aria-expanded={help}
        onClick={() => {
          if (canPrompt) void prompt();
          else setHelp((h) => !h);
        }}
      >
        <Download aria-hidden="true" />
        Install app
      </button>
      {help && (
        <div
          role="dialog"
          aria-label="How to install"
          className="absolute right-0 z-50 mt-2 w-72 rounded-md border border-border bg-background p-4 text-left text-sm shadow-lg"
        >
          <p className="font-semibold">Install i-Save on this device</p>
          {ios ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open this site in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Tap Add to Home Screen, then Add.</li>
            </ol>
          ) : (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open the browser menu (three dots).</li>
              <li>Tap Install app or Add to Home screen.</li>
              <li>Confirm. The i-Save icon appears with your apps.</li>
            </ol>
          )}
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-primary hover:underline"
            onClick={() => setHelp(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
