"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import DefaultSwitch from "@/components/minutes/DefaultSwitch";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  Select,
} from "@/components/ui";
import PhoneSuggest from "@/components/work/PhoneSuggest";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ASSIGNABLE_ROLES,
  type MinutesGroup,
  type MinutesMeeting,
  type MinutesMember,
} from "@/lib/minutes";
import { formatJalaliDisplay } from "@/components/work/JalaliDateField";

export default function MinutesGroupPage() {
  const params = useParams<{ id: string }>();
  const groupId = Number(params.id);
  const router = useRouter();
  const { t, n, locale } = useI18n();

  const [group, setGroup] = useState<MinutesGroup | null>(null);
  const [members, setMembers] = useState<MinutesMember[]>([]);
  const [meetings, setMeetings] = useState<MinutesMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("guest");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(groupId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, memberRows, meetingRows] = await Promise.all([
        apiFetch<MinutesGroup>(`/minutes/groups/${groupId}/`),
        apiFetch<MinutesMember[]>(`/minutes/groups/${groupId}/members/`),
        apiList<MinutesMeeting>(`/minutes/meetings/?group=${groupId}`),
      ]);
      setGroup(row);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      setMeetings(meetingRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadGroupFail"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    if (!phone.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/minutes/groups/${groupId}/invite/`, {
        method: "POST",
        body: { phone_number: phone.trim(), role },
      });
      setInviteOpen(false);
      setPhone("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.inviteFail"));
    } finally {
      setSaving(false);
    }
  };

  const toggleDefault = async () => {
    if (!group) return;
    setBusy(true);
    try {
      const updated = await apiFetch<MinutesGroup>(`/minutes/groups/${group.id}/`, {
        method: "PATCH",
        body: { is_default: !group.is_default },
      });
      setGroup(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.groupFail"));
    } finally {
      setBusy(false);
    }
  };

  const startMeeting = async () => {
    setBusy(true);
    try {
      const meeting = await apiFetch<MinutesMeeting>("/minutes/meetings/", {
        method: "POST",
        body: { group: groupId },
      });
      router.push(`/minutes/meetings/${meeting.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.meetingFail"));
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!group) return <Alert>{t("minutes.notFound")}</Alert>;

  const canManage = Boolean(group.can_manage);
  const latin = locale === "en";

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkBreadcrumb
          fallbackHref="/minutes"
          items={[
            { href: "/minutes", label: t("minutes.crumb") },
            { href: `/minutes/companies/${group.company}`, label: group.company_name || t("minutes.company") },
            { label: group.name },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
              📞 {t("minutes.invite")}
            </Button>
          )}
          {canManage && (
            <Button size="sm" loading={busy} onClick={startMeeting}>
              📝 {t("minutes.newMeeting")}
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-bold text-ink">
            {group.is_default ? "⭐ " : ""}
            {group.name}
          </h1>
          <p className="text-xs text-gray-500">{group.company_name}</p>
        </div>
        <DefaultSwitch on={group.is_default} disabled={busy} onToggle={toggleDefault} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">👤 {t("minutes.members")}</h2>
        <div className="grid gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2"
            >
              <Avatar src={member.profile_image} name={member.full_name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{member.full_name}</p>
                <p className="text-[11px] text-gray-500" dir="ltr">
                  {member.phone_number}
                </p>
              </div>
              <Badge>{t(`minutes.role.${member.role}`)}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">📋 {t("minutes.meetings")}</h2>
        {meetings.length === 0 ? (
          <EmptyState
            title={t("minutes.noMeetingTitle")}
            description={t("minutes.noMeetingDesc")}
            action={
              canManage ? (
                <Button size="sm" onClick={startMeeting}>
                  {t("minutes.newMeeting")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-2">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/minutes/meetings/${meeting.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm transition hover:border-navy-400"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {meeting.name} #{n(meeting.meeting_number)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {formatJalaliDisplay(meeting.date, latin)} · {t(`minutes.${meeting.status}`)}
                  </p>
                </div>
                <span className="text-xs text-navy-800">
                  {t("minutes.openItems", { count: n(meeting.open_item_count) })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Modal open={inviteOpen} title={t("minutes.invite")} onClose={() => setInviteOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("minutes.invite")}>
            <PhoneSuggest value={phone} onChange={setPhone} />
          </Field>
          <Field label={t("minutes.inviteRole")}>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((item) => (
                <option key={item} value={item}>
                  {t(`minutes.role.${item}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={invite}>
              {t("minutes.invite")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
