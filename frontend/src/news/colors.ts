const KNOWN: Record<string, string> = {
  "anthropic-news": "#e8a87c",
  "anthropic-engineering": "#e8a87c",
  "openai-news": "#4ade80",
  "deepmind-blog": "#60a5fa",
  "google-ai-blog": "#60a5fa",
  "meta-ai": "#38bdf8",
  "mit-news-ai": "#f43f5e",
  "stanford-hai": "#fb7185",
  "stanford-ai-lab": "#fb7185",
  "huggingface-blog": "#facc15",
  "techcrunch-ai": "#34d399",
  "theverge-ai": "#c084fc",
  "hacker-news-ai": "#fb923c",
  "nvidia-blog": "#76b900",
  "microsoft-research": "#00a4ef",
  "arxiv-cs-ai": "#b31b1b",
  "arxiv-cs-lg": "#b31b1b",
  "arxiv-cs-cl": "#b31b1b",
};

const FALLBACK = [
  "#e8a87c",
  "#4ade80",
  "#60a5fa",
  "#38bdf8",
  "#f43f5e",
  "#fb7185",
  "#facc15",
  "#34d399",
  "#c084fc",
  "#fb923c",
  "#a78bfa",
  "#22d3ee",
];

export function sourceColor(slug: string, stored?: string | null) {
  const hex = (stored || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toLowerCase();
  if (KNOWN[slug]) return KNOWN[slug];
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return FALLBACK[Math.abs(hash) % FALLBACK.length];
}
