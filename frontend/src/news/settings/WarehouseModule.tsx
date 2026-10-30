"use client";

import { useEffect, useState } from "react";

import { getWarehouse, patchWarehouse, syncWarehouse } from "../api";
import { copy } from "../copy";
import { formatWhen } from "../dates";
import { useSignal } from "../SignalContext";
import type { WarehouseSettings } from "../types";

export default function WarehouseModule() {
  const { lang } = useSignal();
  const L = copy(lang);
  const [row, setRow] = useState<WarehouseSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getWarehouse()
      .then(setRow)
      .catch(() => setError(L.saveFail));
  }, [L.saveFail]);

  const save = async (body: Partial<Pick<WarehouseSettings, "enabled" | "interval_hours" | "run_hour" | "run_minute">>) => {
    setBusy(true);
    try {
      const next = await patchWarehouse(body);
      setRow(next);
      setFlash(L.saved);
      window.setTimeout(() => setFlash(""), 1600);
    } catch {
      setFlash(L.saveFail);
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const result = await syncWarehouse();
      const next = await getWarehouse();
      setRow(next);
      setFlash(result.ok ? L.whCopied(result.copied) : result.error || L.saveFail);
      window.setTimeout(() => setFlash(""), 2400);
    } catch {
      setFlash(L.saveFail);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="empty">{error}</div>;
  if (!row) return <div className="empty">…</div>;

  const hours = row.interval_presets.length ? row.interval_presets : [24, 48, 72, 168, 720];
  const minutes = row.minute_presets.length ? row.minute_presets : [0, 15, 30, 45];

  return (
    <section className="set-hero">
      <div className="set-card">
        <div className="kick">{L.whKick}</div>
        <h2>{L.whTitle}</h2>
        <p className="lead-copy">{L.whLead}</p>
        {!row.configured ? <p className="set-warn">{L.whUnconfigured}</p> : null}
        <div className="row">
          <label>
            <span>{L.whSwitch}</span>
            <div className="seg lg">
              <button type="button" className={!row.enabled ? "on" : ""} disabled={busy} onClick={() => save({ enabled: false })}>
                {L.whOff}
              </button>
              <button type="button" className={row.enabled ? "on" : ""} disabled={busy} onClick={() => save({ enabled: true })}>
                {L.whOn}
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
                className={row.interval_hours === value ? "chip on" : "chip"}
                style={{ ["--c" as string]: "var(--acc)" }}
                disabled={busy || !row.enabled}
                onClick={() => save({ interval_hours: value })}
              >
                {L.whHours(value)}
              </button>
            ))}
          </div>
        </div>
        <div className="row set-time">
          <label>
            <span>{L.whWhen}</span>
            <select
              value={row.run_hour}
              disabled={busy || !row.enabled}
              onChange={(event) => save({ run_hour: Number(event.target.value) })}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00{hour === 2 ? ` · ${L.whOffPeak}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{L.whMinute}</span>
            <select
              value={row.run_minute}
              disabled={busy || !row.enabled}
              onChange={(event) => save({ run_minute: Number(event.target.value) })}
            >
              {minutes.map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="set-hint">{L.whHint(row.timezone)}</p>
        <button type="button" className="btn set-sync" disabled={busy} onClick={runNow}>
          {busy ? L.whSyncing : L.whSync}
        </button>
      </div>
      <div className="pulse">
        <h3>{L.nextRun}</h3>
        <div className="when">{row.enabled ? formatWhen(row.next_run_at, lang) : L.whIdle}</div>
        <div className="set-meta">
          <span>
            {L.whLast}
            <b>{formatWhen(row.last_synced_at, lang)}</b>
          </span>
          <span>
            {L.whLastCount}
            <b>{L.whCopied(row.last_sync_count)}</b>
          </span>
          <span>
            {L.whLastId}
            <b>{row.last_synced_id || "—"}</b>
          </span>
          {row.last_error ? (
            <span>
              {L.whError}
              <b>{row.last_error}</b>
            </span>
          ) : null}
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
