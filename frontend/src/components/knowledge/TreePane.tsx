"use client";

import { useEffect, useState, type DragEvent } from "react";

import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { childrenOf, displayTitle, type KmNode } from "@/lib/knowledge";

export default function TreePane({
  nodes,
  activeId,
  renameRequestId,
  onRenameDone,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onExport,
  onMove,
  onCollapse,
}: {
  nodes: KmNode[];
  activeId: number | null;
  renameRequestId: number | null;
  onRenameDone: () => void;
  onCollapse: () => void;
  onOpen: (node: KmNode) => void;
  onCreate: (type: "folder" | "page", parentId: number | null) => void;
  onRename: (node: KmNode, title: string) => void;
  onDelete: (node: KmNode) => void;
  onDuplicate: (node: KmNode) => void;
  onExport: (node: KmNode) => void;
  onMove: (nodeId: number, parentId: number | null, position: number) => void;
}) {
  const { t } = useI18n();
  const roots = childrenOf(nodes, null);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "var(--km-sidebar)" }}>
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={onCollapse}
          title={t("km.collapseTree")}
          aria-label={t("km.collapseTree")}
          className="km-tool flex size-8 shrink-0 items-center justify-center rounded-lg"
        >
          <PanelIcon />
        </button>
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-bold">{t("nav.knowledge")}</p>
      </div>
      <div className="flex gap-1 px-2 pb-2">
        <button
          type="button"
          onClick={() => onCreate("page", null)}
          className="km-new flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-semibold"
          style={{ background: "var(--km-selection)" }}
        >
          {t("km.newPage")}
        </button>
        <button
          type="button"
          onClick={() => onCreate("folder", null)}
          className="km-new flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-semibold"
          style={{ background: "var(--km-selection)" }}
        >
          {t("km.newFolder")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {roots.length === 0 ? (
          <p className="px-2 text-xs leading-5" style={{ color: "var(--km-faint)" }}>
            {t("km.emptyTree")}
          </p>
        ) : (
          roots.map((node) => (
            <Branch
              key={node.id}
              node={node}
              nodes={nodes}
              activeId={activeId}
              renameRequestId={renameRequestId}
              onRenameDone={onRenameDone}
              onOpen={onOpen}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onExport={onExport}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Branch({
  node,
  nodes,
  activeId,
  renameRequestId,
  onRenameDone,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onExport,
  onMove,
}: {
  node: KmNode;
  nodes: KmNode[];
  activeId: number | null;
  renameRequestId: number | null;
  onRenameDone: () => void;
  onOpen: (node: KmNode) => void;
  onCreate: (type: "folder" | "page", parentId: number | null) => void;
  onRename: (node: KmNode, title: string) => void;
  onDelete: (node: KmNode) => void;
  onDuplicate: (node: KmNode) => void;
  onExport: (node: KmNode) => void;
  onMove: (nodeId: number, parentId: number | null, position: number) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(node.depth < 1);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(node.title);
  const children = childrenOf(nodes, node.id);
  const active = node.id === activeId;
  const label = displayTitle(node.title, t("km.dailyFolder"));

  useEffect(() => {
    if (renameRequestId === node.id) {
      setTitle(node.title);
      setRenaming(true);
      setOpen(true);
    }
  }, [renameRequestId, node.id, node.title]);

  const dropOn = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer.getData("text/km-node");
    const dragged = Number(raw);
    if (!dragged || dragged === node.id) return;
    if (node.type === "folder") {
      onMove(dragged, node.id, children.length);
      setOpen(true);
      return;
    }
    onMove(dragged, node.parent_id, node.position);
  };

  return (
    <div>
      <div
        className={cx("group flex h-8 items-center gap-1 rounded-md px-1", active && "font-semibold")}
        style={{ background: active ? "var(--km-selection)" : undefined }}
        draggable={!renaming}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/km-node", String(node.id));
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={dropOn}
      >
        {node.type === "folder" ? (
          <button
            type="button"
            className="w-4 shrink-0 text-[10px]"
            style={{ color: "var(--km-faint)" }}
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? t("km.collapse") : t("km.expand")}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 shrink-0 text-center text-[10px]" style={{ color: "var(--km-accent)" }}>
            {node.is_daily ? "☼" : "≡"}
          </span>
        )}
        {renaming ? (
          <input
            className="km-field min-w-0 flex-1 rounded px-1.5 py-0.5 text-sm"
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() => {
              setRenaming(false);
              onRenameDone();
              const next = title.trim();
              if (next && next !== node.title) onRename(node, next);
              else setTitle(node.title);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setTitle(node.title);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate py-0.5 text-start text-sm"
            onClick={() => {
              onOpen(node);
              if (node.type === "folder") setOpen(true);
            }}
            onDoubleClick={() => {
              setTitle(node.title);
              setRenaming(true);
            }}
          >
            {node.icon ? `${node.icon} ` : ""}
            {label}
          </button>
        )}
        <button
          type="button"
          className="rounded px-1 text-xs opacity-100 transition md:opacity-0 md:group-hover:opacity-100"
          style={{ color: "var(--km-muted)" }}
          aria-label={t("km.actions")}
          onClick={() => setMenu((value) => !value)}
        >
          ···
        </button>
      </div>
      {menu ? (
        <div
          className="mx-5 mb-1 overflow-hidden rounded-lg border text-xs"
          style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)" }}
        >
          {node.type === "folder" ? (
            <>
              <MenuItem label={t("km.newPage")} onClick={() => { onCreate("page", node.id); setMenu(false); }} />
              <MenuItem label={t("km.newFolder")} onClick={() => { onCreate("folder", node.id); setMenu(false); }} />
            </>
          ) : null}
          <MenuItem label={t("km.rename")} onClick={() => { setRenaming(true); setTitle(node.title); setMenu(false); }} />
          <MenuItem label={t("km.duplicate")} onClick={() => { onDuplicate(node); setMenu(false); }} />
          <MenuItem label={t("km.export")} onClick={() => { onExport(node); setMenu(false); }} />
          <MenuItem label={t("km.delete")} danger onClick={() => { onDelete(node); setMenu(false); }} />
        </div>
      ) : null}
      {open && children.length > 0 ? (
        <div className="ms-3 border-s ps-1" style={{ borderColor: "var(--km-border)" }}>
          {children.map((child) => (
            <Branch
              key={child.id}
              node={child}
              nodes={nodes}
              activeId={activeId}
              renameRequestId={renameRequestId}
              onRenameDone={onRenameDone}
              onOpen={onOpen}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onExport={onExport}
              onMove={onMove}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] rtl:-scale-x-100" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 5v14" stroke="currentColor" strokeWidth="1.7" />
      <path d="m14.5 10-2 2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-1.5 text-start hover:opacity-80"
      style={{ color: danger ? "var(--km-danger)" : "var(--km-text)" }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

