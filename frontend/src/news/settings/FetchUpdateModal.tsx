"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";

import { getFreshness, getJob, startFetch } from "../api";
import { copy, fmtN } from "../copy";
import { formatDual } from "../dates";
import { useSignal } from "../SignalContext";
import type { FetchJob, FreshnessSnapshot, NewsSource } from "../types";

type Phase = "idle" | "checking" | "fresh" | "running" | "done" | "failed" | "busy";

export default function FetchUpdateModal({
  open,
  sources,
  onClose,
  onFinished,
}: {
  open: boolean;
  sources: NewsSource[];
  onClose: () => void;
  onFinished: () => void;
}) {
  const { lang } = useSignal();
  const L = copy(lang);
  const [sourceId, setSourceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<FetchJob | null>(null);
  const [snap, setSnap] = useState<FreshnessSnapshot | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setMessage("");
    setJob(null);
    setSnap(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setPhase("checking");
    setProgress(6);
    setMessage(L.updChecking);
    const sid = sourceId ? Number(sourceId) : null;
    getFreshness({ sourceId: sid })
      .then((row) => {
        setSnap(row);
        if (row.fetch_running) {
          setPhase("busy");
          setProgress(0);
          setMessage(L.updRunning);
          return;
        }
        if (row.up_to_date) {
          setPhase("fresh");
          setProgress(100);
          const name = sid ? sources.find((s) => s.id === sid)?.name : null;
          setMessage(name ? L.updAlreadySrc(name) : L.updAlready);
          return;
        }
        setPhase("idle");
        setProgress(0);
        setMessage("");
      })
      .catch(() => {
        setPhase("idle");
        setProgress(0);
        setMessage(L.saveFail);
      });
  }, [open, sourceId, L, sources, reset]);

  useEffect(() => {
    if (!job || (job.status !== "pending" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      getJob(job.id)
        .then((row) => {
          setJob(row);
          if (row.status === "pending") setProgress((p) => Math.min(p + 3, 28));
          else if (row.status === "running") setProgress((p) => Math.min(Math.max(p, 32) + 7, 92));
          else if (row.status === "done") {
            setProgress(100);
            setPhase("done");
            const label = row.source_name || (sourceId ? sources.find((s) => s.id === Number(sourceId))?.name : null);
            setMessage(label ? L.updDoneNamed(label) : L.updDoneAll);
            onFinished();
          } else if (row.status === "failed") {
            setProgress(100);
            setPhase("failed");
            setMessage(L.failed);
            onFinished();
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [job, sourceId, sources, L, lang, onFinished]);

  const run = async (force = false) => {
    setPhase("running");
    setProgress(10);
    setMessage(L.updProgress);
    try {
      const row = await startFetch({
        source_id: sourceId ? Number(sourceId) : null,
        date_from: from || null,
        date_to: to || null,
        force,
      });
      setJob(row);
      if (row.status === "done") {
        setProgress(100);
        setPhase("done");
        const label = row.source_name || (sourceId ? sources.find((s) => s.id === Number(sourceId))?.name : null);
        setMessage(label ? L.updDoneNamed(label) : L.updDoneAll);
        onFinished();
      } else if (row.status === "failed") {
        setProgress(100);
        setPhase("failed");
        setMessage(L.failed);
      }
    } catch (err) {
      if (err instanceof ApiError && err.data && typeof err.data === "object") {
        const data = err.data as Record<string, unknown>;
        const rawKey = data.message_key;
        const key = Array.isArray(rawKey) ? String(rawKey[0] || "") : String(rawKey || "");
        if (key === "up_to_date" || (err.status === 409 && data.up_to_date === true)) {
          setPhase("fresh");
          setProgress(100);
          setMessage(L.updAlready);
          return;
        }
        if (key === "running" || err.status === 409) {
          setPhase("busy");
          setProgress(0);
          setMessage(L.updRunning);
          return;
        }
      }
      setPhase("failed");
      setProgress(0);
      setMessage(err instanceof Error ? err.message : L.saveFail);
    }
  };

  if (!open) return null;

  const dual = formatDual(snap?.last_fetched_at ?? null, lang);
  const showForm = phase === "idle" || phase === "fresh" || phase === "busy" || phase === "checking";
  const formLocked = phase === "checking" || phase === "running";
  const canStart = phase === "idle";

  return (
    <>
      <div className="scrim on" onClick={phase === "running" ? undefined : onClose} />
      <div className="fetch-modal" role="dialog" aria-modal="true" aria-labelledby="fetch-modal-title">
        <div className="fetch-modal-head">
          <div>
            <div className="kick">{L.updKick}</div>
            <h2 id="fetch-modal-title">{L.updModalTitle}</h2>
          </div>
          <button type="button" className="ib" onClick={onClose} disabled={phase === "running"}>
            ✕
          </button>
        </div>

        {showForm ? (
          <div className="row" style={{ marginBottom: 14 }}>
            <label>
              <span>{L.aS}</span>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={formLocked}>
                <option value="">{L.all}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{L.aF}</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={formLocked} />
            </label>
            <label>
              <span>{L.aTo}</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={formLocked} />
            </label>
          </div>
        ) : null}

        <div className="fetch-progress" aria-hidden={phase === "idle" && !message}>
          <div className="fetch-progress-meta">
            <span>{phase === "checking" ? L.updChecking : phase === "running" ? L.updProgress : message || L.updProgress}</span>
            <b>{L.updPct(fmtN(Math.round(progress), lang))}</b>
          </div>
          <div className="fetch-bar">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>

        {message && phase !== "running" && phase !== "checking" ? (
          <p className={`fetch-msg${phase === "fresh" || phase === "done" ? " ok" : phase === "failed" || phase === "busy" ? " bad" : ""}`}>
            {message}
          </p>
        ) : null}

        {snap?.last_fetched_at ? (
          <div className="fetch-dual">
            <span>
              <em>{L.updGreg}</em>
              {dual.gregorian}
            </span>
            <span>
              <em>{L.updJal}</em>
              {dual.jalali}
            </span>
          </div>
        ) : null}

        {job && (phase === "done" || phase === "running") ? (
          <div className="stats" style={{ marginTop: 12 }}>
            <span>
              <b>{fmtN(job.found_count, lang)}</b>
              {L.found}
            </span>
            <span>
              <b>{fmtN(job.new_count, lang)}</b>
              {L.nw}
            </span>
            <span>
              <b>{fmtN(job.skipped_count, lang)}</b>
              {L.dup}
            </span>
            <span>
              <b>{fmtN(job.failed_count, lang)}</b>
              {L.fail}
            </span>
          </div>
        ) : null}

        <div className="fetch-actions">
          {canStart && phase === "idle" ? (
            <button type="button" className="btn" onClick={() => run(false)}>
              {L.updStart}
            </button>
          ) : null}
          {phase === "fresh" ? (
            <button type="button" className="btn" onClick={() => run(true)}>
              {L.updForce}
            </button>
          ) : null}
          <button type="button" className="ib" onClick={onClose} disabled={phase === "running" || phase === "checking"}>
            {L.updClose}
          </button>
        </div>
      </div>
    </>
  );
}
