import { ApiError, apiDownload, apiFetch, apiList } from "@/lib/api";

export type KmNode = {
  id: number;
  parent_id: number | null;
  type: "folder" | "page";
  title: string;
  icon: string;
  path: string;
  depth: number;
  position: number;
  is_daily: boolean;
  daily_date: string | null;
};

export type KmLink = {
  id: number;
  title: string;
  path: string;
  broken: boolean;
};

export type KmDrawing = {
  id: number;
  node: number;
  strokes: Array<{ points: number[][] }>;
  width: number;
  height: number;
};

export type KmFile = {
  id: number;
  node: number;
  kind: "image" | "pdf";
  size: number;
  name: string;
  url: string;
};

export type KmPage = KmNode & {
  content: Doc;
  schema_version: number;
  version: number;
  links: KmLink[];
  drawings: KmDrawing[];
  files: KmFile[];
  updated_at?: string;
};

export type KmBacklink = {
  id: number;
  title: string;
  path: string;
};

export type KmTemplate = {
  id: number;
  title: string;
  content: Doc;
};

export type PlanDay = {
  id: number;
  day_number: number;
  date: string;
  node: number | null;
  status: "todo" | "doing" | "done";
};

export type StudyPlan = {
  id: number;
  title: string;
  start_date: string;
  days: number;
  progress: { days: number; done: number; overdue: number; streak: number };
  days_rows: PlanDay[];
};

export type Review = {
  id: number;
  node: number;
  plan_day: number;
  due_date: string;
  step: number;
  done_at: string | null;
  title: string;
  path: string;
};

export type Today = {
  date: string;
  plan_days: PlanDay[];
  reviews: Review[];
  daily_note: KmPage;
};

export type KmMark = { type: "textStyle" | "highlight"; attrs: { color: string } };

export type MarkRange = {
  start: number;
  end: number;
  color?: string | null;
  highlight?: string | null;
};

export type KmBlock = {
  type: string;
  text?: string;
  marks?: KmMark[];
  attrs?: { level?: number; id?: number; title?: string; label?: string; color?: string };
  content?: KmBlock[];
};

export type KmDoc = {
  type: "doc";
  content: KmBlock[];
};

type Doc = KmDoc;
type Block = KmBlock;

export function tehranToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
}

export function docToText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const blocks = (content as Doc).content ?? [];
  return blocks.map(blockToLine).join("\n");
}

function blockToLine(block: Block): string {
  if (block.type === "codeBlock") {
    return "```\n" + inlineText(block.content) + "\n```";
  }
  if (block.type === "bulletList" || block.type === "orderedList") {
    return (block.content ?? [])
      .map((item, index) => {
        const text = inlineText(item.content);
        return block.type === "orderedList" ? `${index + 1}. ${text}` : `- ${text}`;
      })
      .join("\n");
  }
  if (block.type === "blockquote") {
    return inlineText(block.content)
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }
  const text = inlineText(block.content);
  if (block.type === "callout") return inlineText(block.content);
  if (block.type === "heading") {
    const level = Math.min(Math.max(Number(block.attrs?.level ?? 2), 1), 3);
    return `${"#".repeat(level)} ${text}`.trimEnd();
  }
  return text;
}

function inlineText(nodes: Block[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.type === "wikilink") {
        const label = node.attrs?.title || node.attrs?.label || node.attrs?.id || "";
        return `[[${label}]]`;
      }
      if (node.content) return inlineText(node.content);
      return "";
    })
    .join("");
}

function marked(source: string, start: number, end: number, ranges: MarkRange[]): Block[] {
  if (end <= start) return [];
  const cuts = new Set<number>([start, end]);
  for (const range of ranges) {
    const from = Math.max(start, range.start);
    const to = Math.min(end, range.end);
    if (to > from) {
      cuts.add(from);
      cuts.add(to);
    }
  }
  const points = [...cuts].sort((left, right) => left - right);
  const nodes: Block[] = [];
  for (let point = 0; point < points.length - 1; point += 1) {
    const from = points[point];
    const to = points[point + 1];
    const text = source.slice(from, to);
    if (!text) continue;
    let color: string | null = null;
    let highlight: string | null = null;
    for (const range of ranges) {
      if (range.start <= from && range.end >= to) {
        if (range.color) color = range.color;
        if (range.highlight) highlight = range.highlight;
      }
    }
    const marks: KmMark[] = [];
    if (color) marks.push({ type: "textStyle", attrs: { color } });
    if (highlight) marks.push({ type: "highlight", attrs: { color: highlight } });
    nodes.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
  }
  return nodes;
}

export function textToDoc(text: string, ranges: MarkRange[] = []): Doc {
  const lines = text.split("\n");
  const content: Block[] = [];
  let index = 0;
  let offset = 0;
  const advance = (line: string) => {
    offset += line.length + 1;
  };
  while (index < lines.length) {
    const line = lines[index];
    const start = offset;
    if (line.startsWith("```")) {
      advance(line);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        advance(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        advance(lines[index]);
        index += 1;
      }
      content.push({ type: "codeBlock", content: body.length ? [{ type: "text", text: body.join("\n") }] : [] });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const prefix = heading[1].length + 1;
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: marked(text, start + prefix, start + line.length, ranges),
      });
      advance(line);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: Block[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        const item = lines[index];
        const itemStart = offset;
        const prefix = item.match(/^[-*]\s+/)?.[0].length ?? 2;
        items.push({ type: "listItem", content: [{ type: "paragraph", content: marked(text, itemStart + prefix, itemStart + item.length, ranges) }] });
        advance(item);
        index += 1;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: Block[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const item = lines[index];
        const itemStart = offset;
        const prefix = item.match(/^\d+\.\s+/)?.[0].length ?? 3;
        items.push({ type: "listItem", content: [{ type: "paragraph", content: marked(text, itemStart + prefix, itemStart + item.length, ranges) }] });
        advance(item);
        index += 1;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }
    if (line.startsWith(">")) {
      const parts: Block[] = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        const item = lines[index];
        const itemStart = offset;
        const prefix = item.match(/^>\s?/)?.[0].length ?? 1;
        if (parts.length) parts.push({ type: "text", text: "\n" });
        parts.push(...marked(text, itemStart + prefix, itemStart + item.length, ranges));
        advance(item);
        index += 1;
      }
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: parts }] });
      continue;
    }
    content.push({ type: "paragraph", content: marked(text, start, start + line.length, ranges) });
    advance(line);
    index += 1;
  }
  return { type: "doc", content };
}

export function slashQuery(text: string, cursor: number): string | null {
  const lineStart = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const line = text.slice(lineStart, cursor);
  if (!line.startsWith("/") || line.slice(1).includes(" ")) return null;
  return line.slice(1);
}

/** The system folder is stored as Daily. Show it in the reader's language. */
export function displayTitle(title: string, dailyLabel: string): string {
  return title === "Daily" ? dailyLabel : title;
}

export type PageStudy = {
  crumbs: Array<{ id: number; title: string }>;
  course: string | null;
  dayDate: string | null;
  status: PlanDay["status"] | null;
  nextReview: string | null;
};

export function pageStudy(page: KmNode, nodes: KmNode[], plans: StudyPlan[], reviews: Review[]): PageStudy {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain: KmNode[] = [];
  let parent = page.parent_id ? byId.get(page.parent_id) : undefined;
  while (parent) {
    chain.push(parent);
    parent = parent.parent_id ? byId.get(parent.parent_id) : undefined;
  }
  chain.reverse();
  const ids = new Set<number>([page.id, ...chain.map((node) => node.id)]);
  const days = plans.flatMap((plan) => plan.days_rows).filter((day) => day.node != null && ids.has(day.node));
  const today = tehranToday();
  const upcoming = days.filter((day) => day.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const match = upcoming[0] ?? days.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const nextReview =
    reviews
      .filter((review) => ids.has(review.node) && !review.done_at)
      .map((review) => review.due_date)
      .sort()[0] ?? null;
  return {
    crumbs: chain.map((node) => ({ id: node.id, title: node.title })),
    course: match?.node ? (byId.get(match.node)?.title ?? null) : null,
    dayDate: match?.date ?? null,
    status: match?.status ?? null,
    nextReview,
  };
}

export function linkQuery(text: string, cursor: number): string | null {
  const upto = text.slice(0, cursor);
  const open = upto.lastIndexOf("[[");
  if (open < 0) return null;
  const chunk = upto.slice(open + 2);
  if (chunk.includes("]]") || chunk.includes("\n") || chunk.length > 80) return null;
  return chunk;
}

export function childrenOf(nodes: KmNode[], parentId: number | null): KmNode[] {
  return nodes
    .filter((node) => node.parent_id === parentId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

export const knowledgeApi = {
  tree: () => apiFetch<KmNode[]>("/knowledge/tree/"),
  page: (id: number) => apiFetch<KmPage>(`/knowledge/nodes/${id}/`),
  create: (body: { parent_id?: number | null; type: "folder" | "page"; title: string; template_id?: number }) =>
    apiFetch<KmPage>("/knowledge/nodes/", { method: "POST", body }),
  save: (id: number, version: number, body: { title?: string; content?: Doc; icon?: string }) =>
    apiFetch<KmPage>(`/knowledge/nodes/${id}/`, { method: "PATCH", body: { version, ...body } }),
  renameFolder: (id: number, title: string) =>
    apiFetch<KmPage>(`/knowledge/nodes/${id}/`, { method: "PATCH", body: { title } }),
  remove: (id: number) => apiFetch<null>(`/knowledge/nodes/${id}/`, { method: "DELETE" }),
  restore: (id: number) => apiFetch<KmPage>(`/knowledge/nodes/${id}/restore/`, { method: "POST" }),
  move: (id: number, parent_id: number | null, position: number) =>
    apiFetch<KmPage>(`/knowledge/nodes/${id}/move/`, { method: "POST", body: { parent_id, position } }),
  duplicate: (id: number) => apiFetch<KmPage>(`/knowledge/nodes/${id}/duplicate/`, { method: "POST" }),
  backlinks: (id: number) => apiFetch<KmBacklink[]>(`/knowledge/nodes/${id}/backlinks/`),
  export: (node: KmNode) =>
    apiDownload(
      `/knowledge/nodes/${node.id}/export/`,
      `${node.title}.${node.type === "folder" ? "zip" : "md"}`,
    ),
  search: (q: string, folderId?: number | null) => {
    const params = new URLSearchParams({ q });
    if (folderId) params.set("folder_id", String(folderId));
    return apiFetch<Array<KmNode & { snippet: string }>>(`/knowledge/search/?${params}`);
  },
  titles: (q: string) => apiFetch<KmNode[]>(`/knowledge/search/titles/?q=${encodeURIComponent(q)}`),
  today: () => apiFetch<Today>("/knowledge/today/"),
  daily: (date?: string) => apiFetch<KmPage>(`/knowledge/daily/${date ? `?date=${date}` : ""}`),
  plans: () => apiList<StudyPlan>("/knowledge/plans/"),
  createPlan: (title: string, start_date: string, days: number) =>
    apiFetch<StudyPlan>("/knowledge/plans/", { method: "POST", body: { title, start_date, days } }),
  updateDay: (id: number, body: { node_id?: number | null; status?: PlanDay["status"] }) =>
    apiFetch<PlanDay>(`/knowledge/plan-days/${id}/`, { method: "PATCH", body }),
  shift: (id: number, days: number) =>
    apiFetch<StudyPlan>(`/knowledge/plans/${id}/shift/`, { method: "POST", body: { days } }),
  finishReview: (id: number) =>
    apiFetch<Review>(`/knowledge/reviews/${id}/`, { method: "PATCH", body: { done: true } }),
  templates: () => apiFetch<KmTemplate[]>("/knowledge/templates/"),
  saveInk: (body: { node_id: number; strokes: KmDrawing["strokes"]; width: number; height: number }, id?: number) =>
    apiFetch<KmDrawing>(id ? `/knowledge/ink/${id}/` : "/knowledge/ink/", {
      method: id ? "PATCH" : "POST",
      body,
    }),
  upload: async (nodeId: number, file: File) => {
    const form = new FormData();
    form.set("node_id", String(nodeId));
    form.set("file", file);
    return apiFetch<KmFile>("/knowledge/attachments/", { method: "POST", formData: form });
  },
};

export function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}
