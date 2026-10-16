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

function lineDiv(html: string): string {
  return `<div>${html || "<br>"}</div>`;
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
        return lineDiv(`${escapeHtml(prefix)}${inlinesHtml(item.content)}`);
      })
      .join("");
  }
  if (block.type === "blockquote") {
    const lines = quoteLines(block.content);
    return lines.map((line) => lineDiv(`&gt; ${inlinesHtml(line)}`)).join("");
  }
  if (block.type === "heading") {
    const level = Math.min(Math.max(Number(block.attrs?.level ?? 2), 1), 3);
    return lineDiv(`${escapeHtml("#".repeat(level))} ${inlinesHtml(block.content)}`);
  }
  return lineDiv(inlinesHtml(block.content));
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
  const blocks = content && typeof content === "object" ? ((content as KmDoc).content ?? []) : [];
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
    walkLine(line, null, null, plain, ranges);
  });
  return { plain: plain.value, ranges };
}

function calloutBlock(node: HTMLElement): KmBlock {
  const token: KmTokenId = isToken(node.dataset.callout) ? node.dataset.callout : "blue";
  const body = [...node.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute("data-label"));
  const { plain, ranges } = linesToMarked(body);
  return { type: "callout", attrs: { color: token }, content: textToDoc(plain, ranges).content };
}

export function editorToDoc(root: HTMLElement): KmDoc {
  const content: KmBlock[] = [];
  let lines: HTMLElement[] = [];
  const flush = () => {
    if (!lines.length) return;
    const { plain, ranges } = linesToMarked(lines);
    content.push(...textToDoc(plain, ranges).content);
    lines = [];
  };
  for (const child of root.childNodes) {
    if (child instanceof HTMLElement && isToken(child.dataset.callout)) {
      flush();
      content.push(calloutBlock(child));
      continue;
    }
    if (child instanceof HTMLElement) lines.push(child);
  }
  flush();
  return { type: "doc", content };
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
