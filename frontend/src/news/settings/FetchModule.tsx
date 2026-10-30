"use client";

import { useEffect, useState } from "react";

import { getPanel, patchPanel } from "../api";
import { copy } from "../copy";
import { formatWhen } from "../dates";
import { useSignal } from "../SignalContext";
import type { FetchMode, PanelSettings } from "../types";

export default function FetchModule() {
  const { lang } = useSignal();
  const L = copy(lang);
  const [panel, setPanel] = useState<PanelSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPanel()
      .then(setPanel)
      .catch(() => setError(L.saveFail));
  }, [L.saveFail]);

  const save = async (body: { fetch_mode?: FetchMode; interval_hours?: number }) => {
    setBusy(true);
    try {
      const next = await patchPanel(body);
      setPanel(next);
      setFlash(L.saved);
      window.setTimeout(() => setFlash(""), 1600);
    } catch {
      setFlash(L.saveFail);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="empty">{error}</div>;
  if (!panel) return <div className="empty">…</div>;

  const scheduled = panel.fetch_mode === "scheduled";

  return (
    <section className="set-hero">
      <div className="set-card">
        <div className="kick">{L.set}</div>
        <h2>{L.setTitle}</h2>
        <p className="lead-copy">{L.setLead}</p>
        <div className="row">
          <label>
            <span>{L.mode}</span>
            <div className="seg lg">
              <button type="button" className={!scheduled ? "on" : ""} disabled={busy} onClick={() => save({ fetch_mode: "manual" })}>
                {L.manual}
              </button>
              <button type="button" className={scheduled ? "on" : ""} disabled={busy} onClick={() => save({ fetch_mode: "scheduled" })}>
                {L.scheduled}
              </button>
            </div>
          </label>
        </div>
        <div className="set-interval">
          <div className="meta">{L.every}</div>
          <div className="chips" style={{ paddingBottom: 0 }}>
            {(panel.interval_presets.length ? panel.interval_presets : [1, 3, 6, 12, 24, 48, 72, 168]).map((hours) => (
              <button
                key={hours}
                type="button"
                className={panel.interval_hours === hours ? "chip on" : "chip"}
                style={{ ["--c" as string]: "var(--acc)" }}
                disabled={busy || !scheduled}
                onClick={() => save({ interval_hours: hours })}
              >
                {L.hours(hours)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="pulse">
        <h3>{L.nextRun}</h3>
        <div className="when">{scheduled ? formatWhen(panel.next_run_at, lang) : L.idle}</div>
        <div className="set-meta">
          <span>
            {L.last}
            <b>{formatWhen(panel.last_scheduled_at, lang)}</b>
          </span>
          <span>
            {L.every}
            <b>{L.hours(panel.interval_hours)}</b>
          </span>
          {flash ? (
            <span>
              <b>{flash}</b>
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
