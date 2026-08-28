"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, EmptyState, cx } from "@/components/ui";
import {
  cardPalette,
  faNum,
  type TreeFolder,
  type TreeProcess,
} from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";

type Kind = "service" | "folder" | "subfolder" | "process" | "step";

const NODE_W = 176;
const NODE_H = 64;
const GAP_X = 22;
const GAP_Y = 108;

type RawNode = {
  key: string;
  label: string;
  kind: Kind;
  color?: string | null;
  href?: string;
  children: RawNode[];
};

type PlacedNode = {
  key: string;
  label: string;
  kind: Kind;
  color?: string | null;
  href?: string;
  childCount: number;
  open: boolean;
  x: number;
  y: number;
};

function processNode(process: TreeProcess): RawNode {
  return {
    key: `process-${process.id}`,
    label: process.name,
    kind: "process",
    color: process.color,
    href: `/explanation/processes/${process.id}`,
    children: process.steps.map((step) => ({
      key: `step-${step.id}`,
      label: step.title,
      kind: "step" as Kind,
      color: process.color,
      href: `/explanation/steps/${step.id}`,
      children: [],
    })),
  };
}

function folderNode(folder: TreeFolder, kind: Kind): RawNode {
  return {
    key: `folder-${folder.id}`,
    label: folder.name,
    kind,
    color: folder.color,
    href: `/explanation/projects/${folder.id}`,
    children: [
      ...folder.children.map((child) => folderNode(child, "subfolder")),
      ...folder.processes.map(processNode),
    ],
  };
}

/**
 * Top-down hierarchy map for تشریح سیستم: سرویس → پوشه → زیرپوشه → فرایند → گام.
 *
 * Children are laid out left to right and then mirrored, so the first child
 * lands on the right and the tree reads naturally in Persian.
 */
export default function TreeView({
  folders,
  rootLabel = "تشریح سیستم",
}: {
  folders: TreeFolder[];
  rootLabel?: string;
}) {
  const { t, n, locale } = useI18n();
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set());
  const [openProcesses, setOpenProcesses] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);

  const root = useMemo<RawNode>(
    () => ({
      key: "service",
      label: rootLabel,
      kind: "service",
      children: folders.map((folder) => folderNode(folder, "folder")),
    }),
    [folders, rootLabel],
  );

  const { nodes, edges, width, height } = useMemo(() => {
    const isOpen = (node: RawNode) => {
      if (node.children.length === 0) return false;
      if (node.kind === "process") return openProcesses.has(node.key);
      return !closedFolders.has(node.key);
    };

    const placed: PlacedNode[] = [];
    const links: { from: PlacedNode; to: PlacedNode }[] = [];
    let cursor = 0;
    let maxDepth = 0;

    const walk = (node: RawNode, depth: number): PlacedNode => {
      maxDepth = Math.max(maxDepth, depth);
      const open = isOpen(node);
      const kids = open ? node.children.map((kid) => walk(kid, depth + 1)) : [];

      let x: number;
      if (kids.length === 0) {
        x = cursor;
        cursor += NODE_W + GAP_X;
      } else {
        x = (kids[0].x + kids[kids.length - 1].x) / 2;
      }

      const self: PlacedNode = {
        key: node.key,
        label: node.label,
        kind: node.kind,
        color: node.color,
        href: node.href,
        childCount: node.children.length,
        open,
        x,
        y: depth * GAP_Y,
      };
      placed.push(self);
      for (const kid of kids) links.push({ from: self, to: kid });
      return self;
    };

    walk(root, 0);

    const totalWidth = Math.max(cursor - GAP_X, NODE_W);
    // Mirror horizontally so the first child sits on the right (RTL reading).
    for (const node of placed) node.x = totalWidth - node.x - NODE_W;

    return {
      nodes: placed,
      edges: links,
      width: totalWidth,
      height: maxDepth * GAP_Y + NODE_H,
    };
  }, [root, closedFolders, openProcesses]);

  const allProcessKeys = useMemo(() => {
    const keys: string[] = [];
    const walk = (node: RawNode) => {
      if (node.kind === "process" && node.children.length > 0) keys.push(node.key);
      node.children.forEach(walk);
    };
    walk(root);
    return keys;
  }, [root]);

  const toggle = (node: PlacedNode) => {
    if (node.childCount === 0) return;
    if (node.kind === "process") {
      setOpenProcesses((current) => {
        const next = new Set(current);
        if (next.has(node.key)) next.delete(node.key);
        else next.add(node.key);
        return next;
      });
      return;
    }
    setClosedFolders((current) => {
      const next = new Set(current);
      if (next.has(node.key)) next.delete(node.key);
      else next.add(node.key);
      return next;
    });
  };

  if (folders.length === 0) {
    return (
      <EmptyState
        title={t("exp.treeEmpty")}
        description={t("exp.treeEmptyDesc")}
      />
    );
  }

  const stepsOpen = openProcesses.size > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            aria-label="کوچک‌نمایی"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
            className="size-8 rounded-lg text-sm font-bold text-navy-800 transition hover:bg-surface"
          >
            −
          </button>
          <span className="w-14 text-center text-xs font-medium text-gray-600">
            {locale === "fa" ? faNum(Math.round(zoom * 100)) : n(Math.round(zoom * 100))}%
          </span>
          <button
            type="button"
            aria-label="بزرگ‌نمایی"
            onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
            className="size-8 rounded-lg text-sm font-bold text-navy-800 transition hover:bg-surface"
          >
            +
          </button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setOpenProcesses(stepsOpen ? new Set() : new Set(allProcessKeys))
          }
        >
          {stepsOpen ? t("exp.hideSteps") : t("exp.showSteps")}
        </Button>
        {closedFolders.size > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setClosedFolders(new Set())}
          >
            {t("exp.openFolders")}
          </Button>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
          <span className="font-medium text-gray-600">{t("exp.layers")}</span>
          <span>{t("common.folder")}</span>
          <span aria-hidden>←</span>
          <span>{t("common.subfolder")}</span>
          <span aria-hidden>←</span>
          <span>{t("common.process")}</span>
          <span aria-hidden>←</span>
          <span>{t("common.step")}</span>
        </div>
      </div>

      <div
        className="overflow-auto rounded-2xl border border-gray-200 bg-white p-6 max-md:p-3"
        style={{
          backgroundImage:
            "linear-gradient(#f3f4f6 1px, transparent 1px), linear-gradient(90deg, #f3f4f6 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maxHeight: "72vh",
        }}
      >
        <div
          style={{
            width: width * zoom,
            height: height * zoom,
            minWidth: "100%",
          }}
        >
          <div
            dir="ltr"
            className="relative"
            style={{
              width,
              height,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <svg
              width={width}
              height={height}
              className="pointer-events-none absolute inset-0"
              aria-hidden
            >
              {edges.map(({ from, to }) => {
                const sx = from.x + NODE_W / 2;
                const sy = from.y + NODE_H;
                const tx = to.x + NODE_W / 2;
                const ty = to.y;
                const my = (sy + ty) / 2;
                const stroke =
                  to.kind === "step"
                    ? "#94a3b8"
                    : cardPalette(to.color).accent;
                return (
                  <g key={`${from.key}-${to.key}`}>
                    <path
                      d={`M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={0.45}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <circle cx={tx} cy={ty} r={3} fill={stroke} fillOpacity={0.6} />
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => (
              <NodeBox
                key={node.key}
                node={node}
                kindLabel={t(`common.${node.kind === "subfolder" ? "subfolder" : node.kind}`)}
                onToggle={() => toggle(node)}
                countLabel={locale === "fa" ? faNum(node.childCount) : n(node.childCount)}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {t("exp.treeHint")}
      </p>
    </div>
  );
}

function NodeBox({
  node,
  onToggle,
  kindLabel,
  countLabel,
}: {
  node: PlacedNode;
  onToggle: () => void;
  kindLabel: string;
  countLabel: string;
}) {
  const palette = cardPalette(node.color);
  const isService = node.kind === "service";
  const isStep = node.kind === "step";

  const background = isService
    ? "#131a22"
    : isStep
      ? "#ffffff"
      : palette.bg;
  const borderColor = isService
    ? "#131a22"
    : isStep
      ? "#e5e7eb"
      : palette.border;
  const textColor = isService ? "#ffffff" : isStep ? "#0f1111" : palette.text;

  return (
    <div
      className="absolute"
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
    >
      <div
        className={cx(
          "relative flex h-full items-center gap-2 rounded-xl px-3 shadow-sm transition",
          node.href && "hover:shadow-md",
          node.kind === "folder" ? "border-2" : "border",
        )}
        style={{ backgroundColor: background, borderColor }}
      >
        {node.kind === "process" && (
          <span
            className="absolute inset-y-0 left-0 w-1.5 rounded-s-xl"
            style={{ backgroundColor: palette.accent }}
            aria-hidden
          />
        )}
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: isService ? "#ff9900" : palette.accent,
          }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span
            className="block text-[10px] font-semibold opacity-70"
            style={{ color: textColor }}
          >
            {kindLabel}
          </span>
          <span
            className="block truncate text-[13px] font-bold"
            style={{ color: textColor }}
            title={node.label}
          >
            {node.label}
          </span>
        </span>
        {node.href && (
          <Link
            href={node.href}
            aria-label={node.label}
            className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-800"
          />
        )}
      </div>

      {node.childCount > 0 && (
        <button
          type="button"
          onClick={onToggle}
          title={node.open ? "بستن" : "باز کردن"}
          aria-label={node.open ? "بستن" : "باز کردن"}
          className="absolute -bottom-3 left-1/2 z-[3] flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-full border border-gray-300 bg-white px-1.5 text-[11px] font-bold text-navy-800 shadow-sm transition hover:border-navy-700 hover:bg-surface"
        >
          {node.open ? "−" : countLabel}
        </button>
      )}
    </div>
  );
}
