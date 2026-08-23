"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Alert, Button, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { MEET_FEATURE, MEET_NEW_URL, type WorkMeeting, type WorkMeetingPayload } from "@/lib/meet";
import type { WorkProjectMember, WorkTeam } from "@/lib/work";

type MeetCtx = {
  projectId: number;
  members: WorkProjectMember[];
  teams: WorkTeam[];
  canCreate: boolean;
  live: WorkMeeting[];
  open: boolean;
  setOpen: (next: boolean) => void;
  reload: () => Promise<void>;
  endMeeting: (id: number) => Promise<void>;
};

const MeetContext = createContext<MeetCtx | null>(null);

function useMeet() {
  return useContext(MeetContext);
}

export function WorkMeetScope({
  projectId,
  members,
  teams,
  canCreate,
  children,
}: {
  projectId: number;
  members: WorkProjectMember[];
  teams: WorkTeam[];
  canCreate: boolean;
  children: ReactNode;
}) {
  const [rows, setRows] = useState<WorkMeeting[]>([]);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!MEET_FEATURE || !Number.isFinite(projectId)) return;
    try {
      const data = await apiFetch<WorkMeetingPayload>(`/work/projects/${projectId}/meetings/`);
      setRows(data.results || []);
    } catch {
      setRows([]);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 15000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const endMeeting = useCallback(
    async (id: number) => {
      await apiFetch(`/work/projects/${projectId}/meetings/${id}/end/`, { method: "POST" });
      await reload();
    },
    [projectId, reload],
  );

  const live = useMemo(() => rows.filter((row) => row.is_live && row.meet_url), [rows]);
  const value = useMemo(
    () => ({
      projectId,
      members,
      teams,
      canCreate,
      live,
      open,
      setOpen,
      reload,
      endMeeting,
    }),
    [projectId, members, teams, canCreate, live, open, reload, endMeeting],
  );

  if (!MEET_FEATURE) return children;
  return <MeetContext.Provider value={value}>{children}</MeetContext.Provider>;
}

function GoogleMeetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#00832D" d="M8 12h16v10H8z" />
      <path fill="#0066DA" d="M8 26h16v10H8z" />
      <path fill="#E94235" d="M24 12h10v10H24z" />
      <path fill="#2684FC" d="M24 26h10v10H24z" />
      <path fill="#00AC47" d="M34 17.5 44 12v24l-10-5.5z" />
    </svg>
  );
}

export function WorkMeetButton() {
  const { t } = useI18n();
  const meet = useMeet();
  if (!meet) return null;
  const { canCreate, setOpen, live } = meet;
  if (!canCreate && live.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#00897B] px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#00796B]"
    >
      <GoogleMeetMark className="size-4 rounded-sm" />
      {t("work.meet")}
      {live.length > 0 ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
      ) : null}
    </button>
  );
}

export function WorkMeetLiveBar() {
  const { t } = useI18n();
  const meet = useMeet();
  if (!meet) return null;
  const { live, endMeeting } = meet;
  if (live.length === 0) return null;
  return (
    <div className="space-y-2">
      {live.map((meeting) => (
        <div
          key={meeting.id}
          className="meet-live-bar relative overflow-hidden rounded-xl border border-[#4FD1C5]/50 bg-gradient-to-l from-[#14233A] to-[#1A2B49] px-3 py-2.5 text-white shadow-[0_0_24px_rgba(0,137,123,0.35)]"
        >
          <span className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_20%_50%,rgba(79,209,197,0.22),transparent_55%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <GoogleMeetMark className="size-8 shrink-0 rounded-md" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#4FD1C5]">
                  {t("work.meetLive")}
                </p>
                <p className="truncate text-sm font-bold">{meeting.title}</p>
                <p className="text-[11px] text-white/70">
                  {t("work.meetHost", { name: meeting.host_name })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {meeting.can_end && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
                  onClick={() => void endMeeting(meeting.id)}
                >
                  {t("work.meetEnd")}
                </Button>
              )}
              {meeting.meet_url && (
                <a
                  href={meeting.meet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-[#00AC47] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#00832D]"
                >
                  {t("work.meetJoin")}
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkMeetModal() {
  const { t } = useI18n();
  const meet = useMeet();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!meet?.open) return;
    setTitle("");
    setLink("");
    setAudience("all");
    setPicked([]);
    setFormError(null);
  }, [meet?.open]);

  if (!meet || !meet.open) return null;
  const { setOpen, projectId, members, teams, canCreate, live, reload, endMeeting } = meet;

  const toggleUser = (userId: number) => {
    setPicked((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const save = async () => {
    if (!title.trim()) {
      setFormError(t("work.meetNameRequired"));
      return;
    }
    if (!link.trim()) {
      setFormError(t("work.meetLinkRequired"));
      return;
    }
    if (audience === "selected" && picked.length === 0) {
      setFormError(t("work.meetNobody"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/meetings/`, {
        method: "POST",
        body: {
          title: title.trim(),
          meet_url: link.trim(),
          audience,
          user_ids: audience === "selected" ? picked : [],
        },
      });
      await reload();
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.meetFail"));
    } finally {
      setSaving(false);
    }
  };

  const activeMembers = members.filter((member) => member.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#14233A]/70"
        aria-label={t("common.close")}
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#1A2B49] to-[#14233A] text-white shadow-[0_20px_50px_rgba(20,35,58,0.45)]">
        <header className="flex items-start justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-[#4FD1C5]">{t("work.meetKicker")}</p>
            <h2 className="mt-0.5 text-lg font-bold">{t("work.meetTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-white/75">{t("work.meetIntro")}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-white/10 px-2 py-1 text-sm text-white/80 hover:bg-white/20"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5">
          {formError && <Alert>{formError}</Alert>}

          {live.length > 0 && (
            <div className="space-y-2">
              {live.map((meeting) => (
                <div key={meeting.id} className="rounded-xl border border-[#4FD1C5]/30 bg-white/5 p-3">
                  <p className="text-xs font-bold text-[#4FD1C5]">{t("work.meetLive")}</p>
                  <p className="mt-0.5 font-bold">{meeting.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {meeting.meet_url && (
                      <a
                        href={meeting.meet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-[#00AC47] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        {t("work.meetJoin")}
                      </a>
                    )}
                    {meeting.can_end && (
                      <button
                        type="button"
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold"
                        onClick={() => void endMeeting(meeting.id)}
                      >
                        {t("work.meetEnd")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canCreate && (
            <>
              <a
                href={MEET_NEW_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white px-3 py-3 text-[#14233A] transition hover:border-[#00AC47]"
              >
                <GoogleMeetMark className="size-10 shrink-0 rounded-md" />
                <span>
                  <span className="block text-sm font-bold">{t("work.meetOpenGoogle")}</span>
                  <span className="block text-xs text-[#1A2B49]/70">{t("work.meetOpenHint")}</span>
                </span>
              </a>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/90">{t("work.meetName")}</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#4FD1C5]"
                  placeholder={t("work.meetNamePlaceholder")}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/90">{t("work.meetLink")}</span>
                <input
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#4FD1C5]"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                />
                <span className="mt-1 block text-xs text-white/50">{t("work.meetLinkHint")}</span>
              </label>

              <div>
                <p className="mb-1.5 text-sm font-medium text-white/90">{t("work.meetAudience")}</p>
                <div className="flex gap-2">
                  {(
                    [
                      ["all", t("work.meetAllTeam")],
                      ["selected", t("work.meetPickPeople")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAudience(value)}
                      className={cx(
                        "rounded-lg px-3 py-1.5 text-xs font-bold",
                        audience === value ? "bg-[#00897B] text-white" : "bg-white/10 text-white/80",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {audience === "selected" && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <p className="mb-2 text-xs text-white/60">{t("work.meetPickHint")}</p>
                  {teams.length > 0 && (
                    <p className="mb-2 text-[11px] text-white/45">
                      {teams.map((team) => team.name).join(" · ")}
                    </p>
                  )}
                  {activeMembers.length === 0 ? (
                    <p className="text-xs text-white/50">{t("work.meetNoTeam")}</p>
                  ) : (
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {activeMembers.map((member) => (
                        <li key={member.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10">
                            <input
                              type="checkbox"
                              className="size-4 accent-[#00897B]"
                              checked={picked.includes(member.user)}
                              onChange={() => toggleUser(member.user)}
                            />
                            <span className="text-sm">{member.full_name || member.phone_number}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <Button className="w-full !bg-[#00AC47] !text-white hover:!bg-[#00832D]" loading={saving} onClick={() => void save()}>
                {t("work.meetSave")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
