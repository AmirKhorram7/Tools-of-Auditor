"use client";

import { useEffect, useState } from "react";

import { getJob, listJobs, startFetch } from "./api";
import { copy, fmtN } from "./copy";
import { useSignal } from "./SignalContext";
import type { FetchJob, NewsSource } from "./types";

export default function SignalAdmin({
  open,
  sources,
}: {
  open: boolean;
  sources: NewsSource[];
}) {
  const { lang } = useSignal();
  const L = copy(lang);
  const [sourceId, setSourceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [job, setJob] = useState<FetchJob | null>(null);
  const [hist, setHist] = useState<FetchJob[]>([]);

  useEffect(() => {
    if (!open) return;
    listJobs()
      .then(setHist)
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!job || (job.status !== "pending" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      getJob(job.id)
        .then((row) => {
          setJob(row);
          if (row.status === "pending") setProgress((p) => Math.min(p + 4, 40));
          else if (row.status === "running") setProgress((p) => Math.min(p + 8, 90));
          else setProgress(100);
          if (row.status === "done" || row.status === "failed") {
            setBusy(false);
            listJobs().then(setHist).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  const go = async () => {
    setBusy(true);
    setProgress(8);
    try {
      const row = await startFetch({
        source_id: sourceId ? Number(sourceId) : null,
        date_from: from || null,
        date_to: to || null,
      });
      setJob(row);
      if (row.status === "done" || row.status === "failed") {
        setProgress(100);
        setBusy(false);
        listJobs().then(setHist).catch(() => undefined);
      }
    } catch {
      setBusy(false);
      setProgress(0);
    }
  };

  const counts = job ?? hist[0];

  return (
    <section className={open ? "admin on" : "admin"}>
      <h3>{L.aT}</h3>
      <div className="row">
        <label>
          <span>{L.aS}</span>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
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
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>{L.aTo}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn" style={{ padding: "10px 22px" }} onClick={go} disabled={busy}>
          {busy ? L.running : L.go}
        </button>
      </div>
      <div className="prog">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="stats">
        <span>
          <b>{fmtN(counts?.found_count ?? 0, lang)}</b>
          {L.found}
        </span>
        <span>
          <b>{fmtN(counts?.new_count ?? 0, lang)}</b>
          {L.nw}
        </span>
        <span>
          <b>{fmtN(counts?.skipped_count ?? 0, lang)}</b>
          {L.dup}
        </span>
        <span>
          <b>{fmtN(counts?.failed_count ?? 0, lang)}</b>
          {L.fail}
        </span>
      </div>
      <div className="hist">
        {hist.slice(0, 4).map((row) => {
          const name = row.source_name || L.all;
          const mark = row.status === "done" ? "✓" : row.status === "failed" ? "✕" : "…";
          const label =
            row.status === "done" ? L.done : row.status === "failed" ? L.failed : L.running;
          return (
            <div key={row.id}>
              {mark} {name} — {fmtN(row.new_count, lang)} {L.nw} · {label}
            </div>
          );
        })}
      </div>
    </section>
  );
}
