"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { listSources } from "../api";
import { sourceColor } from "../colors";
import { catLabel, copy, statusLabel } from "../copy";
import { formatDual } from "../dates";
import { useSignal } from "../SignalContext";
import type { NewsSource } from "../types";
import FetchUpdateModal from "./FetchUpdateModal";

export default function UpdateNewsModule() {
  const { lang } = useSignal();
  const L = copy(lang);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [open, setOpen] = useState(false);

  const reload = useCallback(() => {
    listSources(true)
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const active = useMemo(() => sources.filter((s) => s.is_active), [sources]);
  const latestIso = useMemo(() => {
    let best: string | null = null;
    let bestTs = 0;
    for (const row of active) {
      if (!row.last_fetched_at) continue;
      const ts = new Date(row.last_fetched_at).getTime();
      if (ts > bestTs) {
        bestTs = ts;
        best = row.last_fetched_at;
      }
    }
    return best;
  }, [active]);
  const dual = formatDual(latestIso, lang);

  return (
    <>
      <section className="set-hero">
        <div className="set-card">
          <div className="kick">{L.updKick}</div>
          <h2>{L.updTitle}</h2>
          <p className="lead-copy">{L.updLead}</p>
          <button type="button" className="btn set-sync" onClick={() => setOpen(true)}>
            {L.updBtn}
          </button>
        </div>
        <div className="pulse upd-pulse">
          <h3>{L.updLast}</h3>
          {latestIso ? (
            <div className="upd-dual-big">
              <div>
                <em>{L.updGreg}</em>
                <b>{dual.gregorian}</b>
              </div>
              <div>
                <em>{L.updJal}</em>
                <b>{dual.jalali}</b>
              </div>
            </div>
          ) : (
            <div className="when">{L.updNever}</div>
          )}
        </div>
      </section>

      <section className="set-card">
        <h2>{L.srcTitle}</h2>
        <p className="lead-copy">{L.srcLead}</p>
        <div className="upd-cards">
          {sources.map((source) => {
            const d = formatDual(source.last_fetched_at, lang);
            const fresh =
              source.last_fetched_at &&
              (source.last_status === "ok" || source.last_status === "not_modified");
            return (
              <div
                key={source.id}
                className="upd-card"
                style={{
                  ["--c" as string]: sourceColor(source.slug, source.color),
                  opacity: source.is_active ? 1 : 0.45,
                }}
              >
                <div className="upd-card-top">
                  <i />
                  <div>
                    <b>{source.name}</b>
                    <div className="meta">
                      <span className="tag">{catLabel(source.category, lang)}</span>
                      <span className="tag">{source.is_active ? L.srcOn : L.srcOff}</span>
                      <span className="tag">{fresh ? L.updFresh : source.last_fetched_at ? statusLabel(source.last_status, lang) : L.updNever}</span>
                    </div>
                  </div>
                </div>
                <div className="upd-card-dates">
                  <span>
                    <em>{L.updGreg}</em>
                    {source.last_fetched_at ? d.gregorian : L.updNever}
                  </span>
                  <span>
                    <em>{L.updJal}</em>
                    {source.last_fetched_at ? d.jalali : L.updNever}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <FetchUpdateModal
        open={open}
        sources={active}
        onClose={() => setOpen(false)}
        onFinished={reload}
      />
    </>
  );
}
