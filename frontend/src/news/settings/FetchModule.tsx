"use client";

import { useEffect, useMemo, useState } from "react";

import { getPanel, patchPanel } from "../api";
import { copy } from "../copy";
import { formatWhen } from "../dates";
import { useSignal } from "../SignalContext";
import type { FetchMode, PanelSettings } from "../types";

type Draft = {
  fetch_mode: FetchMode;
  interval_hours: number;
  run_hour: number;
  run_minute: number;
};

function draftFrom(panel: PanelSettings): Draft {
  return {
    fetch_mode: panel.fetch_mode,
    interval_hours: panel.interval_hours,
    run_hour: panel.run_hour,
    run_minute: panel.run_minute,
  };
}

export default function FetchModule() {
  const { lang } = useSignal();
  const L = copy(lang);
  const [panel, setPanel] = useState<PanelSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPanel()
      .then((row) => {
        setPanel(row);
        setDraft(draftFrom(row));
      })
      .catch(() => setError(L.saveFail));
  }, [L.saveFail]);

  const dirty = useMemo(() => {
    if (!panel || !draft) return false;
    return (
      draft.fetch_mode !== panel.fetch_mode ||
      draft.interval_hours !== panel.interval_hours ||
      draft.run_hour !== panel.run_hour ||
      draft.run_minute !== panel.run_minute
    );
  }, [panel, draft]);

  const save = async () => {
    if (!draft || !dirty) return;
    setBusy(true);
    try {
      const next = await patchPanel(draft);
      setPanel(next);
      setDraft(draftFrom(next));
      setFlash(L.fetchSaved);
      window.setTimeout(() => setFlash(""), 2200);
    } catch {
      setFlash(L.saveFail);
      window.setTimeout(() => setFlash(""), 2200);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="empty">{error}</div>;
  if (!panel || !draft) return <div className="empty">…</div>;

  const scheduled = draft.fetch_mode === "scheduled";
  const hours = panel.interval_presets.length ? panel.interval_presets : [1, 3, 6, 12, 24, 48, 72, 168];
  const minutes = panel.minute_presets.length ? panel.minute_presets : [0, 15, 30, 45];

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
              <button
                type="button"
                className={!scheduled ? "on" : ""}
                disabled={busy}
                onClick={() => setDraft((d) => (d ? { ...d, fetch_mode: "manual" } : d))}
              >
                {L.manual}
              </button>
              <button
                type="button"
                className={scheduled ? "on" : ""}
                disabled={busy}
                onClick={() => setDraft((d) => (d ? { ...d, fetch_mode: "scheduled" } : d))}
              >
                {L.scheduled}
              </button>
            </div>
          </label>
        </div>
        <div className="set-interval">
          <div className="meta">{L.every}</div>
          <div className="chips" style={{ paddingBottom: 0 }}>
            {hours.map((value) => (
              <button
                key={value}
                type="button"
                className={draft.interval_hours === value ? "chip on" : "chip"}
                style={{ ["--c" as string]: "var(--acc)" }}
                disabled={busy || !scheduled}
                onClick={() => setDraft((d) => (d ? { ...d, interval_hours: value } : d))}
              >
                {L.hours(value)}
              </button>
            ))}
          </div>
        </div>
        <div className="row set-time">
          <label>
            <span>{L.fetchWhen}</span>
            <select
              value={draft.run_hour}
              disabled={busy || !scheduled}
              onChange={(event) =>
                setDraft((d) => (d ? { ...d, run_hour: Number(event.target.value) } : d))
              }
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{L.fetchMinute}</span>
            <select
              value={draft.run_minute}
              disabled={busy || !scheduled}
              onChange={(event) =>
                setDraft((d) => (d ? { ...d, run_minute: Number(event.target.value) } : d))
              }
            >
              {minutes.map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="set-hint">{L.fetchHint(panel.timezone)}</p>
        <button type="button" className="btn set-sync" disabled={busy || !dirty} onClick={save}>
          {busy ? L.fetchSaving : L.fetchSave}
        </button>
      </div>
      <div className="pulse">
        <h3>{L.nextRun}</h3>
        <div className="when">{panel.fetch_mode === "scheduled" ? formatWhen(panel.next_run_at, lang) : L.idle}</div>
        <div className="set-meta">
          <span>
            {L.last}
            <b>{formatWhen(panel.last_scheduled_at, lang)}</b>
          </span>
          <span>
            {L.every}
            <b>{L.hours(panel.interval_hours)}</b>
          </span>
          <span>
            {L.fetchWhen}
            <b>
              {String(panel.run_hour).padStart(2, "0")}:{String(panel.run_minute).padStart(2, "0")}
            </b>
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
