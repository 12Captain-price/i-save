import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffErrorMessage } from "@/lib/staff-utils";
import { cn } from "@/lib/utils";

/**
 * One good-looking confirmation dialog for the whole app, replacing the browser's plain
 * pop-ups. Use it like window.confirm, but with await:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete this?", message: "…", tone: "danger" })) { … }
 *
 * For actions that can fail (a database delete), pass `run`. The dialog then shows a spinner
 * while it works, keeps itself open and shows the error in plain words if it fails, and only
 * closes (answering true) once the action has succeeded.
 */
export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" is red and for things that cannot be undone. */
  tone?: "danger" | "default";
  /** Optional action to run on confirm. Errors are shown inside the dialog. */
  run?: () => Promise<unknown>;
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm needs <ConfirmProvider> above it.");
  return ask;
}

type Open = { options: ConfirmOptions; resolve: (answer: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);

  const ask = useCallback<Ask>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setOpen((current) => {
          // A second dialog never stacks on the first: the first is answered "no".
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    [],
  );

  const close = useCallback((answer: boolean) => {
    setOpen((current) => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {open &&
        createPortal(
          <ConfirmDialog options={open.options} onClose={close} />,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (answer: boolean) => void;
}) {
  const danger = options.tone === "danger";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Safe default: a dangerous action starts with "Cancel" focused, so Enter never deletes.
  useEffect(() => {
    (danger ? cancelRef : confirmRef).current?.focus();
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [danger]);

  async function confirm() {
    if (!options.run) return onClose(true);
    setBusy(true);
    setError(null);
    try {
      await options.run();
      onClose(true);
    } catch (e) {
      setError(staffErrorMessage(e));
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && !busy) {
      event.stopPropagation();
      onClose(false);
      return;
    }
    if (event.key !== "Tab") return;
    // Keep Tab inside the dialog.
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    if (!buttons || buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      onKeyDown={onKeyDown}
    >
      <div
        aria-hidden="true"
        className="animate-in fade-in absolute inset-0 bg-black/60 backdrop-blur-sm duration-200"
        onClick={() => !busy && onClose(false)}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl duration-200 sm:slide-in-from-bottom-0"
      >
        <div
          aria-hidden="true"
          className={cn(
            "h-1.5 w-full",
            danger ? "bg-destructive" : "bg-primary",
          )}
        />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full",
                danger
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary",
              )}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="confirm-title"
                className="text-lg leading-snug font-semibold"
              >
                {options.title}
              </h2>
              {options.message && (
                <div
                  id="confirm-message"
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                >
                  {options.message}
                </div>
              )}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              ref={cancelRef}
              variant="outline"
              onClick={() => onClose(false)}
              disabled={busy}
            >
              {options.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              ref={confirmRef}
              variant={danger ? "destructive" : "default"}
              onClick={confirm}
              disabled={busy}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {busy ? "Working…" : (options.confirmLabel ?? "Confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
