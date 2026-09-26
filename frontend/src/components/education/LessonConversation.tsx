"use client";

import { useMemo, useState } from "react";

import { Button, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { currentUserId, type EduComment } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

function MessageBody({ body }: { body: string }) {
  const parts = body.split(/```/);
  if (parts.length < 2) {
    return <p className="whitespace-pre-wrap text-[14px] leading-7 text-ink">{body}</p>;
  }
  return (
    <div className="space-y-2">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre
            key={index}
            dir="ltr"
            className="overflow-x-auto rounded-xl bg-navy-900 p-3 text-[13px] leading-6 text-gray-100"
          >
            <code>{part.replace(/^\n|\n$/g, "")}</code>
          </pre>
        ) : part.trim() ? (
          <p key={index} className="whitespace-pre-wrap text-[14px] leading-7 text-ink">
            {part.trim()}
          </p>
        ) : null,
      )}
    </div>
  );
}

function Thumb({ up, on }: { up: boolean; on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
      {up ? (
        <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zm3 9h7.2a2 2 0 0 0 1.9-1.4l1.7-5.3A1.5 1.5 0 0 0 19.4 11H14V6.6A2.6 2.6 0 0 0 11.4 4h-.2L10 11z" />
      ) : (
        <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zm-3-9H6.8A2 2 0 0 0 4.9 5.4L3.2 10.7A1.5 1.5 0 0 0 4.6 13H10v4.4A2.6 2.6 0 0 0 12.6 20h.2L14 13z" />
      )}
    </svg>
  );
}

function CommentCard({
  row,
  replies,
  onReply,
  onVote,
  canReply = true,
}: {
  row: EduComment;
  replies: EduComment[];
  onReply: (parentId: number, body: string) => Promise<void>;
  onVote: (id: number, value: number) => Promise<void>;
  canReply?: boolean;
}) {
  const { t, n } = useI18n();
  const me = currentUserId();
  const mine = me != null && row.author_id === me;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <article className={cx("rounded-2xl px-4 py-3", mine ? "bg-navy-900 text-white" : "bg-gray-50")}>
      <p className={cx("mb-1 text-xs font-semibold", mine ? "text-brand-400" : "text-navy-800")}>
        {row.author_name || t("edu.teacher")}
        {row.is_teacher ? <span className="ms-2 font-medium opacity-80">{t("edu.teacher")}</span> : null}
      </p>
      <div className={mine ? "[&_p]:text-white" : undefined}>
        <MessageBody body={row.body} />
      </div>
      <div className={cx("mt-3 flex flex-wrap items-center gap-3 text-xs", mine ? "text-white/80" : "text-gray-500")}>
        <button
          type="button"
          onClick={() => onVote(row.id, row.my_vote === 1 ? 0 : 1)}
          className={cx("inline-flex items-center gap-1", row.my_vote === 1 && "text-green-600")}
          aria-label={t("edu.commentLike")}
        >
          <Thumb up on={row.my_vote === 1} />
          <span>{n(row.like_count ?? 0)}</span>
        </button>
        <button
          type="button"
          onClick={() => onVote(row.id, row.my_vote === -1 ? 0 : -1)}
          className={cx("inline-flex items-center gap-1", row.my_vote === -1 && "text-red-600")}
          aria-label={t("edu.commentDislike")}
        >
          <Thumb up={false} on={row.my_vote === -1} />
          <span>{n(row.dislike_count ?? 0)}</span>
        </button>
        {canReply ? (
          <button type="button" onClick={() => setOpen((value) => !value)} className="font-semibold">
            {t("edu.reply")}
          </button>
        ) : null}
      </div>
      {replies.length ? (
        <div className="mt-3 space-y-2 border-s border-white/20 ps-3">
          {replies.map((item) => (
            <CommentCard key={item.id} row={item} replies={[]} onReply={onReply} onVote={onVote} canReply={false} />
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] text-ink"
            placeholder={t("edu.replyPlaceholder")}
          />
          <div>
            <Button
              size="sm"
              onClick={async () => {
                if (!text.trim()) return;
                await onReply(row.id, text.trim());
                setText("");
                setOpen(false);
              }}
              disabled={!text.trim()}
            >
              {t("edu.reply")}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function LessonConversation({
  courseId,
  lessonId,
  comments,
  onComments,
}: {
  courseId: number;
  lessonId: number;
  comments: EduComment[];
  onComments: (rows: EduComment[]) => void;
}) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [asCode, setAsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const roots = useMemo(() => comments.filter((row) => !row.parent), [comments]);
  const kids = useMemo(() => {
    const map: Record<number, EduComment[]> = {};
    comments.forEach((row) => {
      if (!row.parent) return;
      map[row.parent] = [...(map[row.parent] ?? []), row];
    });
    return map;
  }, [comments]);

  const send = async (text: string, parent?: number) => {
    setSending(true);
    setError(null);
    try {
      const row = await apiFetch<EduComment>(`/education/courses/${courseId}/comments/`, {
        method: "POST",
        body: {
          body: !parent && asCode ? `\`\`\`\n${text}\n\`\`\`` : text,
          lesson: lessonId,
          parent,
        },
      });
      onComments([...comments, row]);
      if (!parent) {
        setBody("");
        setAsCode(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.commentFail"));
    } finally {
      setSending(false);
    }
  };

  const vote = async (id: number, value: number) => {
    try {
      const row = await apiFetch<EduComment>(`/education/comments/${id}/vote/`, {
        method: "POST",
        body: { value },
      });
      onComments(comments.map((item) => (item.id === id ? { ...item, ...row } : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.commentFail"));
    }
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-7">
      <h2 className="text-base font-bold text-ink">{t("edu.talk")}</h2>
      {roots.length ? (
        <div className="flex flex-col gap-3">
          {roots.map((row) => (
            <CommentCard
              key={row.id}
              row={row}
              replies={kids[row.id] ?? []}
              onReply={(parentId, text) => send(text, parentId)}
              onVote={vote}
            />
          ))}
        </div>
      ) : (
        <p className="text-[14px] leading-7 text-gray-500">{t("edu.emptyTalk")}</p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-col gap-3">
        <div className="flex w-fit gap-1 rounded-[10px] bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setAsCode(false)}
            className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", !asCode ? "bg-navy-900 text-white" : "text-gray-600")}
          >
            {t("edu.askText")}
          </button>
          <button
            type="button"
            onClick={() => setAsCode(true)}
            className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", asCode ? "bg-navy-900 text-white" : "text-gray-600")}
          >
            {t("edu.askCode")}
          </button>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={asCode ? 8 : 4}
          dir={asCode ? "ltr" : undefined}
          className="w-full resize-y rounded-[10px] border border-gray-200 px-3 py-3 text-[14px] leading-6 text-ink outline-none placeholder:text-gray-400 focus:border-navy-800"
          placeholder={t("edu.askTeacher")}
        />
        <div>
          <Button onClick={() => send(body.trim())} disabled={!body.trim() || sending} className="h-11 px-6 text-sm font-semibold">
            {t("edu.sendQuestion")}
          </Button>
        </div>
      </div>
    </section>
  );
}
