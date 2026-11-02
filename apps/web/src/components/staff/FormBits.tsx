import type { ReactNode, TextareaHTMLAttributes } from "react";
import { inputClass } from "@/components/ui/field";

export function TextAreaField({
  id,
  label,
  hint,
  ...props
}: {
  id: string;
  label: string;
  hint?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <textarea id={id} name={id} className={inputClass} {...props} />
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export const FORMAT_HINT = (
  <>
    Start a heading line with <code>##</code>. Leave a blank line between
    paragraphs. Link with <code>[text](/page)</code>. A line with just{" "}
    <code>{"{{contact}}"}</code> shows the office details.
  </>
);

export function PageHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <>
      <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{lead}</p>
    </>
  );
}
