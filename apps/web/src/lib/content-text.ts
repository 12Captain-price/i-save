// Page and FAQ text is stored as plain text with three small conventions, so staff never
// write HTML and nothing they type can inject markup:
//   ## Heading          a section heading
//   blank line          starts a new paragraph
//   [label](/path)      a link (only /paths, https:// and mailto: are allowed)
//   {{contact}}         on its own line: the office details from the Contact page

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "link"; label: string; href: string };

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; parts: Inline[] }
  | { kind: "contact" };

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function isSafeHref(href: string): boolean {
  return (
    (href.startsWith("/") && !href.startsWith("//")) ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  );
}

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const index = m.index ?? 0;
    if (!isSafeHref(m[2])) continue; // leave unsafe links as plain text
    if (index > last)
      parts.push({ kind: "text", text: text.slice(last, index) });
    parts.push({ kind: "link", label: m[1], href: m[2] });
    last = index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of source.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n");
    let paragraph: string[] = [];
    const flush = () => {
      const text = paragraph.join(" ").trim();
      if (text) blocks.push({ kind: "paragraph", parts: parseInline(text) });
      paragraph = [];
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (line === "{{contact}}") {
        flush();
        blocks.push({ kind: "contact" });
      } else if (line.startsWith("## ")) {
        flush();
        blocks.push({ kind: "heading", text: line.slice(3).trim() });
      } else if (line) {
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}
