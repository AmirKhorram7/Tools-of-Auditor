"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Avatar, cx, Spinner } from "@/components/ui";
import { ApiError, apiFetch, mediaUrl } from "@/lib/api";
import { chatTheme, wallpaperStyle } from "@/lib/chatAppearance";
import { useI18n } from "@/lib/i18n";
import {
  formatChatTime,
  teamInitials,
  type WorkDeskChatMessage,
  type WorkProjectMember,
  type WorkTeam,
} from "@/lib/work";

const POLL_MS = 1800;
const MAX_FILE = 40 * 1024 * 1024;
const INPUT_MAX_H = 112;

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconClip() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        d="M8.2 11.6 12.4 7.4a2.4 2.4 0 1 1 3.4 3.4l-5.5 5.5a3.6 3.6 0 0 1-5.1-5.1l5.2-5.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMic() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <rect x="7.4" y="3" width="5.2" height="8.2" rx="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.2 9.6a4.8 4.8 0 0 0 9.6 0M10 14.4V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ rtl }: { rtl?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cx("size-4", rtl && "-scale-x-100")}
      fill="currentColor"
      aria-hidden
    >
      <path d="M3.1 17.2 18 10 3.1 2.8l.4 5.6L12.2 10 3.5 11.6z" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCompress() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path d="M8 4v4H4M12 4v4h4M8 16v-4H4M12 16v-4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconBack({ rtl }: { rtl?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cx("size-4", rtl && "rotate-180")}
      fill="none"
      aria-hidden
    >
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" aria-hidden>
      <circle cx="7.2" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13.2" cy="7.6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.2 15.2c.4-2.2 2-3.4 4-3.4s3.6 1.2 4 3.4M11.4 11.8c1.5-.2 3 .8 3.4 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChatMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5A2.5 2.5 0 0 1 13.5 13H9l-3.5 3v-3H6.5A2.5 2.5 0 0 1 4 10.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Ticks({ count }: { count: 1 | 2 }) {
  return (
    <svg viewBox="0 0 16 12" className="inline-block h-3 w-4" aria-hidden>
      <path
        d="M1.2 6.4 3.7 9 8.8 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {count === 2 && (
        <path
          d="M6.4 6.4 8.9 9 14.2 2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function parseChatList(data: unknown): { results: WorkDeskChatMessage[]; othersReadId: number } {
  if (Array.isArray(data)) {
    return { results: data as WorkDeskChatMessage[], othersReadId: 0 };
  }
  if (data && typeof data === "object") {
    const row = data as { results?: WorkDeskChatMessage[]; others_read_id?: number };
    if (Array.isArray(row.results)) {
      return { results: row.results, othersReadId: Number(row.others_read_id || 0) };
    }
  }
  return { results: [], othersReadId: 0 };
}

function HeadButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-navy-900/5 hover:text-navy-900"
    >
      {children}
    </button>
  );
}

function FacePile({ members }: { members: WorkProjectMember[] }) {
  const shown = members.slice(0, 3);
  if (shown.length === 0) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
        <IconChatMark />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
      {shown.map((member) => (
        <Avatar
          key={member.id}
          name={member.full_name || member.phone_number}
          size={28}
          className="ring-2 ring-white"
        />
      ))}
    </span>
  );
}

function ChatMedia({ message }: { message: WorkDeskChatMessage }) {
  const href = mediaUrl(message.file_url || message.file);
  const kind = message.kind || "text";
  if (!href || kind === "text") return null;
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <a href={href} target="_blank" rel="noreferrer" className="mt-1.5 block">
        <img src={href} alt={message.original_name || ""} className="max-h-48 max-w-full rounded-xl object-cover" />
      </a>
    );
  }
  if (kind === "video") {
    return (
      <video src={href} controls className="mt-1.5 max-h-48 w-full rounded-xl bg-black" preload="metadata" />
    );
  }
  if (kind === "audio") {
    return <audio src={href} controls className="mt-1.5 w-full" preload="metadata" />;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1 text-[12px] font-medium underline-offset-2 hover:underline"
    >
      <span className="truncate">{message.original_name || "file"}</span>
    </a>
  );
}

function roleLabel(t: (key: string) => string, role: string): string {
  const key = `work.role.${role}`;
  const label = t(key);
  return label === key ? role : label;
}

function ChatInfo({
  members,
  teams,
  onBack,
}: {
  members: WorkProjectMember[];
  teams: WorkTeam[];
  onBack: () => void;
}) {
  const { t, n, dir } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-navy-900/10 px-2 py-2">
        <HeadButton label={t("work.chatBack")} onClick={onBack}>
          <IconBack rtl={dir === "rtl"} />
        </HeadButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-navy-900">{t("work.chatInfoTitle")}</p>
          <p className="text-[11px] text-gray-500">{t("work.chat")}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <section>
          <h3 className="mb-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
            <span>{t("work.chatGroups")}</span>
            <span>{n(teams.length)}</span>
          </h3>
          {teams.length === 0 ? (
            <p className="rounded-xl bg-gray-100 px-3 py-2.5 text-[12px] leading-5 text-gray-500">
              {t("work.chatNoGroups")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link
                    href={`/work/teams/${team.id}`}
                    className="flex items-center gap-2.5 rounded-xl border border-navy-900/10 bg-white px-2.5 py-2 hover:border-brand-500"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[11px] font-bold text-white">
                      {teamInitials(team.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">{team.name}</span>
                      <span className="block text-[11px] text-gray-500">
                        {t("work.chatMembers", { count: n(team.member_count ?? 0) })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
            <span>{t("work.chatPeople")}</span>
            <span>{n(members.length)}</span>
          </h3>
          {members.length === 0 ? (
            <p className="rounded-xl bg-gray-100 px-3 py-2.5 text-[12px] leading-5 text-gray-500">
              {t("work.chatNoMembers")}
            </p>
          ) : (
            <ul className="space-y-1">
              {members.map((member) => {
                const fromTeam = teams.find((team) => team.id === member.added_from_team);
                return (
                  <li key={member.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                    <Avatar name={member.full_name || member.phone_number} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900">
                        {member.full_name || member.phone_number}
                      </span>
                      <span className="block truncate text-[11px] text-gray-500">
                        {roleLabel(t, member.role)}
                        {fromTeam ? ` · ${fromTeam.name}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function DeskChat({
  projectId,
  members,
  teams,
  currentUserId,
  title,
  theme,
  wallpaper,
  expanded = false,
  onToggleExpand,
  onCollapse,
}: {
  projectId: number;
  members: WorkProjectMember[];
  teams: WorkTeam[];
  currentUserId?: number | null;
  title?: string;
  theme?: string;
  wallpaper?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onCollapse?: () => void;
}) {
  const { t, n, locale, dir } = useI18n();
  const look = chatTheme(theme);
  const [messages, setMessages] = useState<WorkDeskChatMessage[]>([]);
  const [othersReadId, setOthersReadId] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const lastId = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const subtitle =
    teams.length > 0
      ? t("work.chatGroupsMeta", {
          groups: n(teams.length),
          members: n(members.length),
        })
      : t("work.chatMembers", { count: n(members.length) });

  const mergeRows = useCallback((rows: WorkDeskChatMessage[], after?: number) => {
    setMessages((current) => {
      const next = !after
        ? rows
        : (() => {
            if (rows.length === 0) return current;
            const known = new Set(current.map((row) => row.id));
            const extra = rows.filter((row) => !known.has(row.id));
            return extra.length ? [...current, ...extra] : current;
          })();
      lastId.current = next[next.length - 1]?.id;
      return next;
    });
  }, []);

  const load = useCallback(
    async (after?: number) => {
      const query = after ? `?after=${after}` : "";
      const payload = parseChatList(
        await apiFetch(`/work/projects/${projectId}/chat/${query}`),
      );
      setOthersReadId(payload.othersReadId);
      mergeRows(payload.results, after);
    },
    [mergeRows, projectId],
  );

  useEffect(() => {
    setMessages([]);
    lastId.current = undefined;
    void load().catch(() => setError(t("work.chatLoadFail")));
  }, [load, t]);

  useEffect(() => {
    let timer: number | null = null;
    const tick = () => {
      if (document.hidden) return;
      void load(lastId.current).catch(() => undefined);
    };
    const start = () => {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(tick, POLL_MS);
    };
    start();
    const onVisible = () => {
      if (!document.hidden) {
        tick();
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 40), INPUT_MAX_H)}px`;
  }, [body]);

  useEffect(() => {
    return () => {
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const pushMessage = (row: WorkDeskChatMessage) => {
    setMessages((current) => {
      const next = current.some((item) => item.id === row.id) ? current : [...current, row];
      lastId.current = next[next.length - 1]?.id;
      return next;
    });
    stickToBottom.current = true;
  };

  const sendPayload = async (form: FormData) => {
    setSending(true);
    setError(null);
    try {
      const row = await apiFetch<WorkDeskChatMessage>(`/work/projects/${projectId}/chat/`, {
        method: "POST",
        formData: form,
      });
      setBody("");
      pushMessage(row);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.chatSendFail"));
    } finally {
      setSending(false);
    }
  };

  const sendText = async () => {
    const text = body.trim();
    if (!text || sending) return;
    const form = new FormData();
    form.append("body", text);
    await sendPayload(form);
  };

  const sendFile = async (file: File, caption = "") => {
    if (file.size > MAX_FILE) {
      setError(t("work.chatFileTooBig"));
      return;
    }
    const form = new FormData();
    if (caption.trim()) form.append("body", caption.trim());
    form.append("file", file, file.name);
    await sendPayload(form);
  };

  const toggleVoice = async () => {
    if (recording) {
      recorder.current?.stop();
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const ext = blob.type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice.${ext}`, { type: blob.type });
        void sendFile(file);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setError(null);
    } catch {
      setError(t("work.chatVoiceFail"));
    }
  };

  const canSend = Boolean(body.trim()) && !sending && !recording;

  return (
    <aside
      dir={dir}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-navy-900/10 bg-white shadow-[0_1px_4px_rgba(20,35,58,0.06)]"
    >
      {infoOpen ? (
        <ChatInfo members={members} teams={teams} onBack={() => setInfoOpen(false)} />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-0.5 border-b border-navy-900/10 px-1.5 py-1.5">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              title={t("work.chatOpenInfo")}
              aria-label={t("work.chatOpenInfo")}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1 text-start hover:bg-navy-900/5"
            >
              <FacePile members={members} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-navy-900">
                  {title?.trim() || t("work.chat")}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                  <IconPeople />
                  <span className="truncate">{subtitle}</span>
                </span>
              </span>
            </button>
            {onToggleExpand && (
              <HeadButton
                label={expanded ? t("work.chatExitFull") : t("work.chatExpand")}
                onClick={onToggleExpand}
              >
                {expanded ? <IconCompress /> : <IconExpand />}
              </HeadButton>
            )}
            {onCollapse && (
              <HeadButton label={t("work.chatClose")} onClick={onCollapse}>
                <IconClose />
              </HeadButton>
            )}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden" style={wallpaperStyle(wallpaper)}>
          <div
            ref={scroller}
            onScroll={(event) => {
              const node = event.currentTarget;
              stickToBottom.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 48;
            }}
            className="absolute inset-0 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3"
          >
            {messages.length === 0 ? (
              <p className="py-8 text-center text-xs leading-6 text-gray-500">{t("work.chatEmpty")}</p>
            ) : (
              messages.map((message) => {
                const mine = message.author === currentUserId;
                const ticks: 1 | 2 = message.id <= othersReadId ? 2 : 1;
                return (
                  <div
                    key={message.id}
                    dir="ltr"
                    className={cx("flex w-full gap-2", mine ? "flex-row-reverse" : "flex-row")}
                  >
                    <Avatar name={message.author_name} size={28} />
                    <div className={cx("max-w-[85%] min-w-0", mine && "text-end")}>
                      <div
                        className={cx(
                          "mb-0.5 flex items-center gap-1.5 text-[10px] text-gray-500",
                          mine ? "flex-row-reverse" : "flex-row",
                        )}
                      >
                        <span className="font-medium text-gray-600">
                          {mine ? t("work.chatYou") : message.author_name || teamInitials("?")}
                        </span>
                      </div>
                      <div
                        className={cx(
                          "rounded-2xl px-3 py-2 text-start text-[13px] leading-6",
                          mine
                            ? "rounded-br-md"
                            : "rounded-bl-md bg-white text-navy-900 shadow-[0_1px_2px_rgba(20,35,58,0.06)]",
                        )}
                        style={
                          mine
                            ? { backgroundColor: look.bubble, color: look.text }
                            : undefined
                        }
                      >
                        {message.body ? (
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        ) : null}
                        <ChatMedia message={message} />
                        <div
                          className={cx(
                            "mt-1 flex items-center justify-end gap-1 text-[10px] leading-none",
                            mine ? "opacity-80" : "text-gray-400",
                          )}
                          style={mine ? { color: look.tick } : undefined}
                        >
                          <span>{formatChatTime(message.created_at, locale)}</span>
                          {mine && (
                            <span
                              title={ticks === 2 ? t("work.chatTicksRead") : t("work.chatTicksSent")}
                              aria-label={ticks === 2 ? t("work.chatTicksRead") : t("work.chatTicksSent")}
                            >
                              <Ticks count={ticks} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>

          <div className="shrink-0 border-t border-navy-900/10 bg-white p-2">
            {error && <p className="mb-1.5 px-1 text-[11px] text-red-600">{error}</p>}
            {recording && (
              <p className="mb-1.5 px-1 text-[11px] font-semibold text-red-600">{t("work.chatRecording")}</p>
            )}
            <form
              className="flex items-end gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void sendText();
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void sendFile(file, body);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-navy-800 hover:bg-navy-900/5"
                title={t("work.chatAttach")}
                aria-label={t("work.chatAttach")}
              >
                <IconClip />
              </button>
              <textarea
                ref={inputRef}
                value={body}
                rows={1}
                maxLength={2000}
                dir={dir}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendText();
                  }
                }}
                placeholder={t("work.chatPlaceholder")}
                className="max-h-28 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-ink caret-current outline-none placeholder:text-gray-400 focus:border-brand-500"
              />
              {canSend || sending ? (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink hover:bg-brand-700 hover:text-white disabled:opacity-50"
                  title={t("work.chatSend")}
                  aria-label={t("work.chatSend")}
                >
                  {sending ? <Spinner className="size-4" /> : <IconSend rtl={dir === "rtl"} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void toggleVoice()}
                  className={cx(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    recording ? "bg-red-600 text-white" : "text-navy-800 hover:bg-navy-900/5",
                  )}
                  title={recording ? t("work.chatStopVoice") : t("work.chatVoice")}
                  aria-label={recording ? t("work.chatStopVoice") : t("work.chatVoice")}
                >
                  <IconMic />
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </aside>
  );
}
