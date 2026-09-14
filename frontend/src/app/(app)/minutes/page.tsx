"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import DefaultSwitch from "@/components/minutes/DefaultSwitch";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
} from "@/components/ui";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkPhotoCard from "@/components/work/WorkPhotoCard";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  minutesCompanyPhoto,
  type MinutesCompany,
  type MinutesGroup,
  type MinutesInvitation,
  type MinutesMeeting,
} from "@/lib/minutes";

export default function MinutesHomePage() {
  const { t, n } = useI18n();
  const [companies, setCompanies] = useState<MinutesCompany[]>([]);
  const [groups, setGroups] = useState<MinutesGroup[]>([]);
  const [meetings, setMeetings] = useState<MinutesMeeting[]>([]);
  const [invites, setInvites] = useState<MinutesInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRows, groupRows, meetingRows, inbox] = await Promise.all([
        apiList<MinutesCompany>("/minutes/companies/"),
        apiList<MinutesGroup>("/minutes/groups/"),
        apiList<MinutesMeeting>("/minutes/meetings/"),
        apiList<MinutesInvitation>("/minutes/invitations/"),
      ]);
      setCompanies(companyRows);
      setGroups(groupRows);
      setMeetings(meetingRows);
      setInvites(inbox.filter((row) => row.status === "pending"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadHomeFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const createCompany = async () => {
    if (!companyName.trim()) {
      setFormError(t("minutes.companyRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/minutes/companies/", {
        method: "POST",
        body: { name: companyName.trim() },
      });
      setCompanyOpen(false);
      setCompanyName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.companyFail"));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (group: MinutesGroup) => {
    setBusyId(group.id);
    try {
      await apiFetch(`/minutes/groups/${group.id}/`, {
        method: "PATCH",
        body: { is_default: !group.is_default },
      });
      await load();
    } catch {
      /* keep */
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <WorkBreadcrumb fallbackHref="/dashboard" items={[{ label: `📝 ${t("minutes.crumb")}` }]} />
          <h1 className="text-base font-bold text-ink">{t("minutes.title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/minutes/inbox">
            <Button variant="secondary" size="sm">
              📩 {t("minutes.inbox")}
              {invites.length > 0 ? ` (${n(invites.length)})` : ""}
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCompanyOpen(true)}>
            + {t("minutes.newCompany")}
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {invites.length > 0 && (
        <Link
          href="/minutes/inbox"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-ink"
        >
          <span>{t("minutes.pendingInvites", { count: n(invites.length) })}</span>
          <span className="shrink-0 font-semibold text-navy-800">{t("minutes.seeAccept")}</span>
        </Link>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">🏢 {t("minutes.companies")}</h2>
        {companies.length === 0 ? (
          <EmptyState
            title={t("minutes.noCompanyTitle")}
            description={t("minutes.noCompanyDesc")}
            action={
              <Button size="sm" onClick={() => setCompanyOpen(true)}>
                {t("minutes.firstCompany")}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {companies.map((company) => {
              const companyGroups = groups.filter((row) => row.company === company.id);
              return (
                <WorkPhotoCard
                  key={company.id}
                  href={`/minutes/companies/${company.id}`}
                  imageSrc={minutesCompanyPhoto(company.id)}
                  className="w-full max-w-[22.5rem]"
                >
                  <p className="truncate text-sm font-bold text-ink">{company.name}</p>
                  <p className="mt-1 text-[11px] font-medium text-navy-800">
                    {t("minutes.groupCardMeta", { members: n(companyGroups.length) })}
                  </p>
                </WorkPhotoCard>
              );
            })}
          </div>
        )}
      </section>

      {groups.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">👥 {t("minutes.groups")}</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
              >
                <Link href={`/minutes/groups/${group.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {group.is_default ? "⭐ " : ""}
                    {group.name}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">{group.company_name}</p>
                </Link>
                <DefaultSwitch
                  on={group.is_default}
                  disabled={busyId === group.id}
                  onToggle={() => setDefault(group)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {meetings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">📋 {t("minutes.meetings")}</h2>
          <div className="grid gap-2">
            {meetings.slice(0, 8).map((meeting) => (
              <Link
                key={meeting.id}
                href={`/minutes/meetings/${meeting.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm transition hover:border-navy-400"
              >
                <span className="min-w-0 truncate font-semibold text-ink">
                  {meeting.name} #{n(meeting.meeting_number)}
                </span>
                <span className="shrink-0 text-[11px] text-gray-500">
                  {t("minutes.openItems", { count: n(meeting.open_item_count) })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={companyOpen}
        title={t("minutes.newCompany")}
        onClose={() => setCompanyOpen(false)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("minutes.companyName")}>
            <Input
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCompany()}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompanyOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createCompany}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
