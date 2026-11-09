import { ArrowDown, ArrowUp, X } from "lucide-react";
import { MediaThumb } from "@/components/site/MediaThumb";
import { inputClass } from "@/components/ui/field";
import type { EventMedia, PendingFile } from "@/lib/content";
import {
  EVENT_MEDIA_ACCEPT,
  MEDIA_LABEL,
  checkEventFile,
} from "@/lib/event-media";

export type EditableMedia = EventMedia;

/**
 * The files of an event or notice, as the admin edits them: a caption box and Up/Down
 * buttons for each file, a Delete button, and a picker for new files (each with its own
 * caption). Nothing is saved until the form's Save button is pressed, except Delete, which
 * asks first.
 */
export function MediaEditor({
  existing,
  onExistingChange,
  onDelete,
  pending,
  onPendingChange,
  onProblem,
  idPrefix,
  noun,
}: {
  existing: EditableMedia[];
  onExistingChange: (items: EditableMedia[]) => void;
  onDelete: (item: EditableMedia) => void;
  pending: PendingFile[];
  onPendingChange: (files: PendingFile[]) => void;
  /** Called with a plain-words message when a chosen file is not allowed (null clears it). */
  onProblem: (message: string | null) => void;
  idPrefix: string;
  /** "event" or "announcement", used in the help text. */
  noun: string;
}) {
  function move(from: number, to: number) {
    if (to < 0 || to >= existing.length) return;
    const next = [...existing];
    [next[from], next[to]] = [next[to], next[from]];
    onExistingChange(next);
  }

  function setCaption(id: string, caption: string) {
    onExistingChange(
      existing.map((m) => (m.id === id ? { ...m, caption } : m)),
    );
  }

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    const bad = chosen.map(checkEventFile).find(Boolean);
    if (bad) {
      onProblem(bad);
      return;
    }
    onProblem(null);
    onPendingChange([
      ...pending,
      ...chosen.map((file) => ({ file, caption: "" })),
    ]);
  }

  return (
    <div className="grid gap-4">
      {existing.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Pictures, videos and PDFs</p>
          <ul className="grid gap-3">
            {existing.map((m, i) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2"
              >
                <MediaThumb
                  item={m}
                  className="aspect-[4/3] w-24 shrink-0 rounded"
                />
                <div className="min-w-[12rem] flex-1">
                  <label
                    htmlFor={`${idPrefix}-cap-${m.id}`}
                    className="mb-1 block text-xs text-muted-foreground"
                  >
                    {MEDIA_LABEL[m.media_type]} {i + 1} · caption (optional)
                  </label>
                  <input
                    id={`${idPrefix}-cap-${m.id}`}
                    className={inputClass}
                    value={m.caption ?? ""}
                    maxLength={200}
                    onChange={(e) => setCaption(m.id, e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${MEDIA_LABEL[m.media_type].toLowerCase()} ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${MEDIA_LABEL[m.media_type].toLowerCase()} ${i + 1} down`}
                    disabled={i === existing.length - 1}
                    onClick={() => move(i, i + 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border disabled:opacity-40"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="ml-1 text-xs text-destructive underline"
                    onClick={() => onDelete(m)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            The first picture is the cover. Captions and order are saved when
            you press Save.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor={`${idPrefix}-files`}
          className="mb-1.5 block text-sm font-medium"
        >
          Add pictures, videos or PDFs
        </label>
        <input
          id={`${idPrefix}-files`}
          type="file"
          multiple
          accept={EVENT_MEDIA_ACCEPT}
          // Clearing the value lets the same file be picked again after removing it.
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
          className="text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {pending.length
            ? `${pending.length} waiting. They upload when you press Save.`
            : `Photos are shrunk automatically. Videos (MP4 or WebM) can be up to 50 MB and PDFs up to 10 MB. They show on the ${noun} page and open in the viewer.`}
        </p>
        {pending.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {pending.map((p, i) => (
              <li
                key={`${p.file.name}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2"
              >
                <span className="max-w-[14rem] truncate text-xs">
                  {p.file.name}
                </span>
                <input
                  aria-label={`Caption for ${p.file.name}`}
                  placeholder="Caption (optional)"
                  className={`${inputClass} min-w-[10rem] flex-1`}
                  value={p.caption}
                  maxLength={200}
                  onChange={(e) =>
                    onPendingChange(
                      pending.map((x, j) =>
                        j === i ? { ...x, caption: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove ${p.file.name}`}
                  onClick={() =>
                    onPendingChange(pending.filter((_, j) => j !== i))
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
