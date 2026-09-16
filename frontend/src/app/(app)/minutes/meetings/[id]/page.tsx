"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CalendarIcon,
  ClerkIcon,
  DuoAcceptIcon,
  DuoEditIcon,
  DuoRestoreIcon,
  GroupIcon,
  MinutesDocIcon,
  MinutesIconTile,
  PlusIcon,
  StatusIcon,
  TrashIcon,
} from "@/components/minutes/MinutesIcons";
import {
  Alert,
  Avatar,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageLoader,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
import JalaliDateField, { formatJalaliDisplay } from "@/components/work/JalaliDateField";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ITEM_STATUSES,
  itemStatusClass,
  meetingStatusClass,
  priorityLabelKey,
  type MinutesItem,
  type MinutesItemStatus,
  type MinutesMeeting,
  type MinutesMember,
} from "@/lib/minutes";

export default function MinutesMeetingPage() {
  const params = useParams<{ id: string }>();
  const meetingId = Number(params.id);
  const router = useRouter();
  const { t, n, locale } = useI18n();
  const latin = locale === "en";

  const [meeting, setMeeting] = useState<MinutesMeeting | null>(null);
  const [members, setMembers] = useState<MinutesMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [lineOpen, setLineOpen] = useState(false);
  const [editing, setEditing] = useState<MinutesItem | null>(null);
  const [lineTitle, setLineTitle] = useState("");
  const [lineDesc, setLineDesc] = useState("");
  const [lineDue, setLineDue] = useState("");
  const [linePriority, setLinePriority] = useState("2");
  const [lineAssignees, setLineAssignees] = useState<number[]>([]);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const items = meeting?.items ?? [];
  const doneCount = items.filter((item) => item.status === "completed").length;

  const load = useCallback(async () => {
    if (!Number.isFinite(meetingId)) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<MinutesMeeting>(`/minutes/meetings/${meetingId}/`);
      setMeeting(row);
      const memberRows = await apiFetch<MinutesMember[]>(`/minutes/groups/${row.group}/members/`);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadMeetingFail"));
    } finally {
      setLoading(false);
    }
  }, [meetingId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const addLine = async (title: string, extra?: Partial<{ description: string; due_date: string; priority: number; assignee_ids: number[] }>) => {
    const clean = title.trim();
    if (!clean) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch(`/minutes/meetings/${meetingId}/items/`, {
        method: "POST",
        body: {
          title: clean,
          description: extra?.description || "",
          due_date: extra?.due_date || null,
          priority: extra?.priority ?? 2,
          assignee_ids: extra?.assignee_ids || [],
        },
      });
      setLineOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.addLineFail"));
    } finally {
      setAdding(false);
    }
  };

  const saveLine = async () => {
    if (!editing) {
      await addLine(lineTitle, {
        description: lineDesc,
        due_date: lineDue,
        priority: Number(linePriority),
        assignee_ids: lineAssignees,
      });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/minutes/meetings/${meetingId}/items/${editing.id}/`, {
        method: "PATCH",
        body: {
          title: lineTitle.trim(),
          description: lineDesc,
          due_date: lineDue || null,
          priority: Number(linePriority),
          assignee_ids: lineAssignees,
        },
      });
      setLineOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.saveLineFail"));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (item: MinutesItem, status: MinutesItemStatus) => {
    try {
      await apiFetch(`/minutes/meetings/${meetingId}/items/${item.id}/`, {
        method: "PATCH",
        body: { status },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.saveLineFail"));
    }
  };

  const removeLine = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await apiFetch(`/minutes/meetings/${meetingId}/items/${deleteId}/`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.saveLineFail"));
    } finally {
      setSaving(false);
    }
  };

  const saveHeader = async () => {
    setSaving(true);
    try {
      await apiFetch(`/minutes/meetings/${meetingId}/`, {
        method: "PATCH",
        body: { name: editName.trim(), date: editDate, description: editDesc },
      });
      setHeaderOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadMeetingFail"));
    } finally {
      setSaving(false);
    }
  };

  const closeMeeting = async () => {
    setSaving(true);
    try {
      await apiFetch(`/minutes/meetings/${meetingId}/close/`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadMeetingFail"));
    } finally {
      setSaving(false);
    }
  };

  const carryOver = async () => {
    setSaving(true);
    try {
      const next = await apiFetch<MinutesMeeting>(`/minutes/meetings/${meetingId}/carry-over/`, {
        method: "POST",
        body: {},
      });
      router.push(`/minutes/meetings/${next.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.carryOverFail"));
      setSaving(false);
    }
  };

  const openNewLine = () => {
    setEditing(null);
    setLineTitle("");
    setLineDesc("");
    setLineDue("");
    setLinePriority("2");
    setLineAssignees([]);
    setAssigneeQuery("");
    setLineOpen(true);
  };

  const openEdit = (item: MinutesItem) => {
    setEditing(item);
    setLineTitle(item.title);
    setLineDesc(item.description || "");
    setLineDue(item.due_date || "");
    setLinePriority(String(item.priority));
    setLineAssignees(item.assignees.map((row) => row.id));
    setAssigneeQuery("");
    setLineOpen(true);
  };

  const toggleAssignee = (id: number) => {
    setLineAssignees((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const statusOptions = useMemo(
    () => ITEM_STATUSES.filter((status) => status !== "cancelled" || meeting?.can_clerk),
    [meeting?.can_clerk],
  );

  if (loading) return <PageLoader />;
  if (!meeting) return <Alert>{t("minutes.notFound")}</Alert>;

  const canAdd = meeting.can_clerk && meeting.status === "open";

  return (
    <div className="flex flex-col gap-4 pt-4 pb-8">
      <WorkBreadcrumb
        fallbackHref="/minutes"
        items={[
          { href: "/minutes", label: t("minutes.crumb") },
          { href: `/minutes/companies/${meeting.company_id}`, label: meeting.company_name },
          { href: `/minutes/groups/${meeting.group}`, label: meeting.group_name },
          { label: meeting.name },
        ]}
      />

      {error && <Alert>{error}</Alert>}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-8 text-ink sm:text-xl">
              {meeting.name} #{n(meeting.meeting_number)}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {meeting.company_name} · {meeting.group_name}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {meeting.can_clerk && (
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => {
                  setEditName(meeting.name);
                  setEditDate(meeting.date);
                  setEditDesc(meeting.description || "");
                  setHeaderOpen(true);
                }}
              >
                <DuoEditIcon className="size-5" />
                {t("minutes.editHeader")}
              </Button>
            )}
            {meeting.can_clerk && meeting.status === "open" && (
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                loading={saving}
                onClick={closeMeeting}
              >
                <DuoAcceptIcon className="size-5" />
                {t("minutes.closeMeeting")}
              </Button>
            )}
            {meeting.can_clerk && meeting.open_item_count > 0 && (
              <Button
                size="sm"
                className="min-h-11 w-full sm:w-auto"
                loading={saving}
                onClick={carryOver}
              >
                <DuoRestoreIcon className="size-5" />
                {t("minutes.carryOver")}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderCell
            tone="brand"
            icon={<ClerkIcon />}
            label={t("minutes.clerk")}
            value={
              <span className="flex items-center gap-2 leading-6">
                <Avatar src={meeting.clerk_image} name={meeting.clerk_name} size={28} />
                <span className="truncate">{meeting.clerk_name}</span>
              </span>
            }
          />
          <HeaderCell
            tone="soft"
            icon={<CalendarIcon />}
            label={t("minutes.meetingDate")}
            value={formatJalaliDisplay(meeting.date, latin)}
          />
          <HeaderCell
            tone="navy"
            icon={<GroupIcon />}
            label={t("minutes.group")}
            value={meeting.group_name}
          />
          <HeaderCell
            tone="soft"
            icon={<StatusIcon />}
            label={t("minutes.status")}
            value={
              <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold leading-5", meetingStatusClass(meeting.status))}>
                {t(`minutes.${meeting.status}`)}
              </span>
            }
          />
        </div>
        {meeting.status !== "open" && (
          <p className="mt-3 text-xs text-gray-500">{t("minutes.closedHint")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-3">
            <MinutesIconTile tone="brand" size="sm">
              <MinutesDocIcon className="size-4" />
            </MinutesIconTile>
            <div>
              <h2 className="text-base font-bold leading-7 text-ink">{t("minutes.lines")}</h2>
              <p className="text-xs text-gray-500">
                {t("minutes.linesMeta", { total: n(items.length), done: n(doneCount) })}
              </p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t("minutes.noLines")}</p>
        ) : (
          <>
            <div className="mb-2 hidden grid-cols-[minmax(0,1.4fr)_7rem_6.5rem_7rem_5.5rem_8.5rem] gap-2 px-2 text-xs font-semibold text-navy-800 lg:grid">
              <span>{t("minutes.subject")}</span>
              <span>{t("minutes.assignees")}</span>
              <span>{t("minutes.due")}</span>
              <span>{t("minutes.status")}</span>
              <span>{t("minutes.daysLeft")}</span>
              <span>{t("minutes.actions")}</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.id} className="py-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_7rem_6.5rem_7rem_5.5rem_8.5rem] lg:items-center lg:gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.description}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-gray-400 lg:hidden">
                      {t(priorityLabelKey(item.priority))}
                    </p>
                  </div>
                  <div className="mt-2 flex -space-x-2 space-x-reverse lg:mt-0">
                    {item.assignees.length === 0 ? (
                      <span className="text-[11px] text-gray-400">—</span>
                    ) : (
                      item.assignees.map((person) => (
                        <Avatar
                          key={person.id}
                          src={person.profile_image}
                          name={person.full_name}
                          size={28}
                          className="ring-2 ring-white"
                        />
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink lg:mt-0">
                    {item.due_date ? formatJalaliDisplay(item.due_date, latin) : "—"}
                  </p>
                  <div className="mt-2 lg:mt-0">
                    {item.can_set_status ? (
                      <select
                        value={item.status}
                        onChange={(e) => setStatus(item, e.target.value as MinutesItemStatus)}
                        className={cx(
                          "rounded-full border-0 px-2 py-1 text-[11px] font-bold leading-5",
                          itemStatusClass(item.status),
                        )}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {t(`minutes.status.${status}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={cx("rounded-full px-2 py-1 text-[11px] font-bold", itemStatusClass(item.status))}>
                        {t(`minutes.status.${item.status}`)}
                      </span>
                    )}
                  </div>
                  <p className={cx("mt-2 text-xs lg:mt-0", item.is_overdue ? "font-bold text-red-600" : "text-gray-500")}>
                    {item.remaining_days == null
                      ? "—"
                      : item.is_overdue
                        ? t("minutes.overdue")
                        : `${n(item.remaining_days)} ${t("minutes.daysUnit")}`}
                  </p>
                  <div className="mt-2 flex gap-1 lg:mt-0">
                    {canAdd && (
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-lg bg-brand-500 text-ink shadow-sm transition hover:bg-brand-700 hover:text-white"
                        onClick={openNewLine}
                        aria-label={t("minutes.addLine")}
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    )}
                    {item.can_edit && (
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-surface"
                        onClick={() => openEdit(item)}
                        aria-label={t("common.edit")}
                      >
                        <DuoEditIcon className="size-5" />
                      </button>
                    )}
                    {item.can_edit && (
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteId(item.id)}
                        aria-label={t("common.delete")}
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {canAdd && (
          <button
            type="button"
            onClick={openNewLine}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-base font-bold text-ink shadow-sm transition hover:bg-brand-700 hover:text-white"
          >
            <PlusIcon className="size-5" />
            {t("minutes.addLine")}
          </button>
        )}
      </section>

      <Modal
        open={headerOpen}
        title={t("minutes.editHeader")}
        onClose={() => setHeaderOpen(false)}
      >
        <div className="space-y-3">
          <Field label={t("minutes.meetingName")}>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <Field label={t("minutes.meetingDate")}>
            <JalaliDateField value={editDate} onChange={setEditDate} />
          </Field>
          <Field label={t("minutes.description")}>
            <Textarea rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-1 max-sm:flex-col-reverse">
            <Button variant="secondary" className="min-h-11 max-sm:w-full" onClick={() => setHeaderOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} className="min-h-11 max-sm:w-full" onClick={saveHeader}>
              <DuoAcceptIcon className="size-5" />
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={lineOpen}
        title={editing ? t("minutes.editLine") : t("minutes.addLine")}
        onClose={() => setLineOpen(false)}
      >
        <div className="space-y-3">
          <Field label={t("minutes.subject")}>
            <Input autoFocus value={lineTitle} onChange={(e) => setLineTitle(e.target.value)} />
          </Field>
          <Field label={t("minutes.lineNotes")}>
            <Textarea rows={3} value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("minutes.due")}>
              <JalaliDateField value={lineDue} onChange={setLineDue} />
            </Field>
            <Field label={t("minutes.priority")}>
              <Select value={linePriority} onChange={(e) => setLinePriority(e.target.value)}>
                <option value="1">{t("minutes.priority.low")}</option>
                <option value="2">{t("minutes.priority.medium")}</option>
                <option value="3">{t("minutes.priority.high")}</option>
                <option value="4">{t("minutes.priority.critical")}</option>
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t("minutes.pickAssignees")}</p>
            <Input
              value={assigneeQuery}
              onChange={(e) => setAssigneeQuery(e.target.value)}
              placeholder={t("minutes.searchAssignees")}
              className="mb-2 min-h-10"
            />
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {members
                .filter((member) => {
                  const query = assigneeQuery.trim().toLowerCase();
                  if (!query) return true;
                  if (lineAssignees.includes(member.id)) return true;
                  return (
                    member.full_name.toLowerCase().includes(query) ||
                    member.phone_number.includes(query)
                  );
                })
                .map((member) => {
                const selected = lineAssignees.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleAssignee(member.id)}
                    className={cx(
                      "flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                      selected
                        ? "border-brand-500 bg-brand-50 font-semibold text-ink"
                        : "border-gray-200 bg-white text-gray-600",
                    )}
                  >
                    <Avatar src={member.profile_image} name={member.full_name} size={22} />
                    {member.full_name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1 max-sm:flex-col-reverse">
            <Button variant="secondary" className="min-h-11 max-sm:w-full" onClick={() => setLineOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={adding || saving}
              className="min-h-11 max-sm:w-full"
              disabled={!lineTitle.trim()}
              onClick={saveLine}
            >
              <DuoAcceptIcon className="size-5" />
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title={t("minutes.deleteLine")}
        onCancel={() => setDeleteId(null)}
        onConfirm={removeLine}
        loading={saving}
      />
    </div>
  );
}

function HeaderCell({
  icon,
  label,
  value,
  tone = "navy",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "navy" | "brand" | "soft";
}) {
  return (
    <div className="flex items-center gap-3">
      <MinutesIconTile tone={tone}>{icon}</MinutesIconTile>
      <div className="min-w-0 leading-6">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className="text-sm font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}
