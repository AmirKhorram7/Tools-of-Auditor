import { isToken, type KmTokenId } from "@/lib/knowledge-colors";
import { textToDoc, type KmBlock, type KmDoc, type MarkRange } from "@/lib/knowledge";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlinesHtml(nodes: KmBlock[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "text") {
        const raw = escapeHtml(node.text ?? "");
        const color = node.marks?.find((mark) => mark.type === "textStyle" && isToken(mark.attrs.color))?.attrs.color;
        const highlight = node.marks?.find((mark) => mark.type === "highlight" && isToken(mark.attrs.color))?.attrs.color;
        if (!color && !highlight) return raw;
        const attrs = [color ? `data-color="${color}"` : "", highlight ? `data-highlight="${highlight}"` : ""].filter(Boolean).join(" ");
        return `<span ${attrs}>${raw}</span>`;
      }
      if (node.type === "wikilink") {
        const label = node.attrs?.title || node.attrs?.label || node.attrs?.id || "";
        return escapeHtml(`[[${label}]]`);
      }
      if (node.content) return inlinesHtml(node.content);
      return "";
    })
    .join("");
}

function lineDiv(html: string, color?: string | null, highlight?: string | null): string {
  const attrs = [
    isToken(color) ? `data-color="${color}"` : "",
    isToken(highlight) ? `data-highlight="${highlight}"` : "",
  ].filter(Boolean);
  return `<div${attrs.length ? ` ${attrs.join(" ")}` : ""}>${html || "<br>"}</div>`;
}

function textNodes(nodes: KmBlock[] | undefined): KmBlock[] {
  const found: KmBlock[] = [];
  const walk = (list: KmBlock[] | undefined) => {
    for (const node of list ?? []) {
      if (node.type === "text") found.push(node);
      else if (node.content) walk(node.content);
    }
  };
  walk(nodes);
  return found;
}

/** One colour for the whole line, or null when the line mixes colours. */
function uniform(nodes: KmBlock[] | undefined, type: "textStyle" | "highlight"): string | null {
  const marks = textNodes(nodes).map((node) => node.marks?.find((mark) => mark.type === type)?.attrs.color ?? "");
  if (!marks.length || marks.some((mark) => mark !== marks[0]) || !isToken(marks[0])) return null;
  return marks[0];
}

function blockHtml(block: KmBlock, labels: Record<string, string>): string {
  if (block.type === "callout") {
    const token: KmTokenId = isToken(block.attrs?.color) ? block.attrs.color : "blue";
    const label = labels[token] ?? labels.blue ?? token;
    const inner = (block.content ?? []).map((child) => lineDiv(inlinesHtml(child.content ?? [child]))).join("");
    return `<div data-callout="${token}"><span data-label="1" contenteditable="false">${escapeHtml(label)}</span>${inner || "<div><br></div>"}</div>`;
  }
  if (block.type === "codeBlock") {
    const body = (block.content ?? []).map((node) => node.text ?? "").join("");
    return ["```", ...body.split("\n"), "```"].map((line) => lineDiv(escapeHtml(line))).join("");
  }
  if (block.type === "bulletList" || block.type === "orderedList") {
    return (block.content ?? [])
      .map((item, index) => {
        const prefix = block.type === "orderedList" ? `${index + 1}. ` : "- ";
        const color = uniform(item.content, "textStyle");
        const highlight = uniform(item.content, "highlight");
        const body = color || highlight ? escapeHtml(textNodes(item.content).map((node) => node.text ?? "").join("")) : inlinesHtml(item.content);
        return lineDiv(`${escapeHtml(prefix)}${body}`, color, highlight);
      })
      .join("");
  }
  if (block.type === "blockquote") {
    const lines = quoteLines(block.content);
    return lines.map((line) => {
      const color = uniform(line, "textStyle");
      const highlight = uniform(line, "highlight");
      const body = color || highlight ? escapeHtml(textNodes(line).map((node) => node.text ?? "").join("")) : inlinesHtml(line);
      return lineDiv(`&gt; ${body}`, color, highlight);
    }).join("");
  }
  if (block.type === "heading") {
    const level = Math.min(Math.max(Number(block.attrs?.level ?? 2), 1), 3);
    const color = uniform(block.content, "textStyle");
    const highlight = uniform(block.content, "highlight");
    const body = color || highlight ? escapeHtml(textNodes(block.content).map((node) => node.text ?? "").join("")) : inlinesHtml(block.content);
    return lineDiv(`${escapeHtml("#".repeat(level))} ${body}`, color, highlight);
  }
  const color = uniform(block.content, "textStyle");
  const highlight = uniform(block.content, "highlight");
  const body = color || highlight ? escapeHtml(textNodes(block.content).map((node) => node.text ?? "").join("")) : inlinesHtml(block.content);
  return lineDiv(body, color, highlight);
}

function quoteLines(nodes: KmBlock[] | undefined): KmBlock[][] {
  const lines: KmBlock[][] = [[]];
  const push = (node: KmBlock) => {
    if (node.type === "text" && (node.text ?? "").includes("\n")) {
      const parts = (node.text ?? "").split("\n");
      parts.forEach((part, index) => {
        if (index) lines.push([]);
        if (part) lines[lines.length - 1].push({ ...node, text: part });
      });
      return;
    }
    if (node.content && node.type !== "text") {
      for (const child of node.content) push(child);
      return;
    }
    lines[lines.length - 1].push(node);
  };
  for (const node of nodes ?? []) push(node);
  return lines;
}

export function docToHtml(content: unknown, labels: Record<string, string>): string {
  const raw = content && typeof content === "object" ? ((content as KmDoc).content ?? []) : [];
  const blocks = compactBlocks(raw);
  if (!blocks.length) return "<div><br></div>";
  return blocks.map((block) => blockHtml(block, labels)).join("");
}

function walkLine(node: Node, color: string | null, highlight: string | null, plain: { value: string }, ranges: MarkRange[]) {
  if (node instanceof HTMLElement && node.dataset.label) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    const start = plain.value.length;
    plain.value += text;
    if (text && (color || highlight)) ranges.push({ start, end: plain.value.length, color, highlight });
    return;
  }
  if (!(node instanceof HTMLElement) || node.tagName === "BR") return;
  const nextColor = isToken(node.dataset.color) ? node.dataset.color : color;
  const nextHighlight = isToken(node.dataset.highlight) ? node.dataset.highlight : highlight;
  node.childNodes.forEach((child) => walkLine(child, nextColor, nextHighlight, plain, ranges));
}

function linesToMarked(lines: HTMLElement[]): { plain: string; ranges: MarkRange[] } {
  const plain = { value: "" };
  const ranges: MarkRange[] = [];
  lines.forEach((line, index) => {
    if (index) plain.value += "\n";
    const color = isToken(line.dataset.color) ? line.dataset.color : null;
    const highlight = isToken(line.dataset.highlight) ? line.dataset.highlight : null;
    walkLine(line, color, highlight, plain, ranges);
  });
  return { plain: plain.value, ranges };
}

function calloutBlock(node: HTMLElement): KmBlock {
  const token: KmTokenId = isToken(node.dataset.callout) ? node.dataset.callout : "blue";
  const body = [...node.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute("data-label"));
  const { plain, ranges } = linesToMarked(body);
  return { type: "callout", attrs: { color: token }, content: textToDoc(plain, ranges).content };
}

function copySkin(from: HTMLElement, to: HTMLElement) {
  if (isToken(from.dataset.color)) to.dataset.color = from.dataset.color;
  if (isToken(from.dataset.highlight)) to.dataset.highlight = from.dataset.highlight;
}

function filled(nodes: Node[]): boolean {
  return nodes.some((node) => (node.textContent ?? "").length > 0);
}

/** Which visual line the caret is in, counting `<br>` breaks inside one block. */
export function caretPiece(line: HTMLElement, caret: Node | null, offset: number): number {
  if (!caret || !line.contains(caret)) return 0;
  let piece = 0;
  const visit = (node: Node): boolean => {
    if (node === caret && node instanceof HTMLElement) {
      for (let index = 0; index < offset && index < node.childNodes.length; index += 1) {
        piece += breakCount(node.childNodes[index]);
      }
      return true;
    }
    if (node === caret) return true;
    if (node instanceof HTMLElement && node.tagName === "BR") {
      piece += 1;
      return false;
    }
    for (const child of node.childNodes) {
      if (visit(child)) return true;
    }
    return false;
  };
  visit(line);
  return piece;
}

function breakCount(node: Node): number {
  if (node instanceof HTMLElement && node.tagName === "BR") return 1;
  if (!(node instanceof HTMLElement)) return 0;
  let count = 0;
  node.childNodes.forEach((child) => {
    count += breakCount(child);
  });
  return count;
}

function hoistBreaks(line: HTMLElement) {
  let guard = 0;
  let nested = [...line.querySelectorAll("br")].find((item) => item.parentElement !== line);
  while (nested && nested.parentElement && guard++ < 30) {
    const parent = nested.parentElement;
    const clone = parent.cloneNode(false) as HTMLElement;
    while (nested.nextSibling) clone.appendChild(nested.nextSibling);
    parent.after(nested);
    if (clone.childNodes.length) nested.after(clone);
    if (!parent.childNodes.length) parent.remove();
    nested = [...line.querySelectorAll("br")].find((item) => item.parentElement !== line);
  }
}

/** Wrap typed text that the browser left on the editor root into line divs. */
export function wrapLoose(root: HTMLElement) {
  let pending: Node[] = [];
  const flush = (before: Node | null) => {
    if (!pending.length) return;
    const div = document.createElement("div");
    pending.forEach((node) => div.appendChild(node));
    if (!div.childNodes.length) div.appendChild(document.createElement("br"));
    root.insertBefore(div, before);
    pending = [];
  };
  for (const node of [...root.childNodes]) {
    if (node instanceof HTMLElement && node.tagName === "DIV") {
      flush(node);
      continue;
    }
    pending.push(node);
  }
  flush(null);
}

/**
 * Split a block only when a `<br>` sits between two pieces of text.
 * A lone `<br>` or a trailing `<br>` is the browser's empty-line marker — leave it.
 */
export function visualLines(line: HTMLElement): HTMLElement[] {
  if (line.dataset.callout) return [line];
  hoistBreaks(line);
  const pieces: Node[][] = [[]];
  for (const node of [...line.childNodes]) {
    if (node instanceof HTMLElement && node.tagName === "BR") pieces.push([]);
    else pieces[pieces.length - 1].push(node);
  }
  if (pieces.length > 1 && !filled(pieces[pieces.length - 1])) pieces.pop();
  if (pieces.length < 2) return [line];
  const created = pieces.map((nodes) => {
    const div = document.createElement("div");
    copySkin(line, div);
    if (!nodes.length) div.appendChild(document.createElement("br"));
    else nodes.forEach((node) => div.appendChild(node));
    line.before(div);
    return div;
  });
  line.remove();
  return created;
}

function separateLines(root: HTMLElement) {
  wrapLoose(root);
  for (const span of [...root.querySelectorAll("span")]) {
    if (span.dataset.label) continue;
    const nested = [...span.children].filter((el) => el.tagName === "DIV");
    if (!nested.length) continue;
    for (const block of nested) {
      if (!(block instanceof HTMLElement)) continue;
      if (isToken(span.dataset.color) && !isToken(block.dataset.color)) block.dataset.color = span.dataset.color;
      if (isToken(span.dataset.highlight) && !isToken(block.dataset.highlight)) block.dataset.highlight = span.dataset.highlight;
    }
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    span.remove();
  }
  for (const child of [...root.children]) {
    if (child instanceof HTMLElement) visualLines(child);
  }
}

function emptyParagraph(block: KmBlock): boolean {
  return block.type === "paragraph" && !(block.content ?? []).some((node) => (node.text ?? "").length > 0);
}

/** Drop the empty-line explosion from older saves. Keep one blank line between text. */
function compactBlocks(blocks: KmBlock[]): KmBlock[] {
  const out: KmBlock[] = [];
  let blanks = 0;
  for (const block of blocks) {
    if (emptyParagraph(block)) {
      blanks += 1;
      if (blanks > 1) continue;
    } else {
      blanks = 0;
    }
    out.push(block);
  }
  return out;
}

export function editorToDoc(root: HTMLElement): KmDoc {
  const clone = root.cloneNode(true) as HTMLElement;
  separateLines(clone);
  const content: KmBlock[] = [];
  let lines: HTMLElement[] = [];
  const flush = () => {
    if (!lines.length) return;
    const { plain, ranges } = linesToMarked(lines);
    content.push(...textToDoc(plain, ranges).content);
    lines = [];
  };
  for (const child of clone.childNodes) {
    if (child instanceof HTMLElement && isToken(child.dataset.callout)) {
      flush();
      content.push(calloutBlock(child));
      continue;
    }
    if (child instanceof HTMLElement) lines.push(child);
  }
  flush();
  return { type: "doc", content: compactBlocks(content) };
}

export function editorPlain(root: HTMLElement, caretNode: Node | null, caretOffset: number): { plain: string; cursor: number } {
  let plain = "";
  let cursor = 0;
  let seen = false;
  const note = (node: Node, at: number) => {
    if (!seen && node === caretNode) {
      cursor = at;
      seen = true;
    }
  };
  const children = [...root.childNodes].filter((node) => node instanceof HTMLElement);
  children.forEach((child, index) => {
    if (index) plain += "\n";
    note(child, plain.length);
    const walk = (node: Node) => {
      if (node instanceof HTMLElement && node.dataset.label) return;
      if (node.nodeType === Node.TEXT_NODE) {
        note(node, plain.length + Math.min(caretOffset, node.textContent?.length ?? 0));
        plain += node.textContent ?? "";
        return;
      }
      if (!(node instanceof HTMLElement) || node.tagName === "BR") {
        note(node, plain.length);
        return;
      }
      note(node, plain.length);
      node.childNodes.forEach((item) => walk(item));
    };
    walk(child);
  });
  return { plain, cursor: seen ? cursor : plain.length };
}
