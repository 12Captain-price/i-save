import { ContactLines } from "@/components/site/ContactLines";
import { parseRichText, type Inline } from "@/lib/content-text";

function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "link" ? (
          <a key={i} href={p.href} className="underline underline-offset-4">
            {p.label}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Shows staff-written text safely: headings, paragraphs, links and the office details. */
export function RichText({
  text,
  className = "space-y-3 text-sm text-muted-foreground",
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {parseRichText(text).map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h2 key={i} className="pt-4 text-lg font-semibold text-foreground">
              {block.text}
            </h2>
          );
        }
        if (block.kind === "contact") return <ContactLines key={i} />;
        return (
          <p key={i}>
            <Parts parts={block.parts} />
          </p>
        );
      })}
    </div>
  );
}
