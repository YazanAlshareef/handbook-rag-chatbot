import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, MIN_CHUNK_CHARS } from "./config";

export type Doc = { id: string; title: string; text: string };
export type Chunk = {
  docId: string;
  docTitle: string;
  section: string;
  text: string;
};

// Upstream files are Jekyll-style markdown: front matter plus {% liquid %} tags.
export function parseDoc(id: string, raw: string): Doc {
  let text = raw.replace(/\r\n/g, "\n");
  let title = id;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+)$/m);
    if (t) title = t[1].trim().replace(/^["']|["']$/g, "");
    text = text.slice(fm[0].length);
  }
  text = text
    .replace(/\{%\s*slack_channel\s+"([^"]+)"\s*%\}/g, "#$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> link text
    .replace(/\{%[\s\S]*?%\}/g, "") // alert / image / leftover tags
    .replace(/<\/?[a-zA-Z][^>]*>/g, "") // inline html
    .replace(/([^\n])\n(?!\n|\s*(?:[-*]|\d+\.)\s|#)/g, "$1 ") // unwrap hard-wrapped lines, keep lists
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { id, title, text };
}

type Section = { path: string; body: string };

function splitSections(text: string): Section[] {
  const out: Section[] = [];
  const stack: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) out.push({ path: stack.filter(Boolean).join(" > "), body });
    buf = [];
  };
  for (const line of text.split("\n")) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const depth = h[1].length;
      stack.length = depth - 1;
      stack[depth - 1] = h[2].trim().replace(/[*_`]/g, "");
    } else buf.push(line);
  }
  flush();
  return out;
}

function pieces(body: string): string[] {
  // paragraphs first; a paragraph longer than the limit is cut at sentence ends
  const out: string[] = [];
  for (const p of body.split(/\n\s*\n/)) {
    const para = p.trim();
    if (!para) continue;
    if (para.length <= CHUNK_MAX_CHARS) out.push(para);
    else out.push(...para.split(/(?<=[.!?])\s+/));
  }
  return out;
}

export function chunkDoc(doc: Doc): Chunk[] {
  const chunks: Chunk[] = [];
  for (const sec of splitSections(doc.text)) {
    let cur = "";
    const emit = () => {
      if (!cur.trim()) return;
      chunks.push({
        docId: doc.id,
        docTitle: doc.title,
        section: sec.path || doc.title,
        text: cur.trim(),
      });
      // overlap: carry the tail of this chunk, starting at a word boundary
      const tail = cur.slice(-CHUNK_OVERLAP_CHARS);
      const sp = tail.indexOf(" ");
      cur = sp >= 0 ? tail.slice(sp + 1) : "";
    };
    let carried = false;
    for (const piece of pieces(sec.body)) {
      if (cur && cur.length + piece.length + 2 > CHUNK_MAX_CHARS) {
        emit();
        carried = true;
      }
      cur = cur ? `${cur}\n\n${piece}` : piece;
      if (cur.length > CHUNK_MAX_CHARS * 1.5) {
        // a single huge piece (no sentence ends): hard cut
        cur = cur.slice(0, CHUNK_MAX_CHARS * 1.5);
        emit();
      }
    }
    // do not emit a chunk that is only the carried-over overlap
    const onlyOverlap = carried && cur.length <= CHUNK_OVERLAP_CHARS && chunks.length > 0 && chunks[chunks.length - 1].text.endsWith(cur.trim());
    if (!onlyOverlap) emit();
  }
  // drop stubs like "See the InSite page." once their link is stripped
  return chunks.filter((c) => c.text.length >= MIN_CHUNK_CHARS);
}

// The text that gets embedded: title and section help short chunks match.
export function embedText(c: Chunk): string {
  return `${c.docTitle} — ${c.section}\n${c.text}`;
}
