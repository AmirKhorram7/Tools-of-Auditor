"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import DefaultSwitch from "@/components/minutes/DefaultSwitch";
import {
  CompanyIcon,
  GroupIcon,
  InboxIcon,
  PlusIcon,
  MinutesDocIcon,
  MinutesIconTile,
  SettingsIcon,
} from "@/components/minutes/MinutesIcons";
import MinutesMeetingsTable from "@/components/minutes/MinutesMeetingsTable";
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  Select,
} from "@/components/ui";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  currentJalaliYear,
  formatJalaliYear,
  type MinutesCompany,
  type MinutesGroup,
  type MinutesInvitation,
  type MinutesMeeting,
} from "@/lib/minutes";

const CONTEXT_KEY = "ta_minutes_context";

function readContext(): { companyId: number | null; groupId: number | null } {
  if (typeof window === "undefined") return { companyId: null, groupId: null };
  try {
    const raw = window.localStorage.getItem(CONTEXT_KEY);
    if (!raw) return { companyId: null, groupId: null };
    const parsed = JSON.parse(raw) as { companyId?: number; groupId?: number };
    return {
      companyId: parsed.companyId ?? null,
      groupId: parsed.groupId ?? null,
    };
  } catch {
    return { companyId: null, groupId: null };
  }
}

function writeContext(companyId: number | null, groupId: number | null) {
  window.localStorage.setItem(CONTEXT_KEY, JSON.stringify({ companyId, groupId }));
}

export default function MinutesHomePage() {
  const router = useRouter();
  const { t, n, locale } = useI18n();
  const [companies, setCompanies] = useState<MinutesCompany[]>([]);
  const [groups, setGroups] = useState<MinutesGroup[]>([]);
  const [meetings, setMeetings] = useState<MinutesMeeting[]>([]);
  const [invites, setInvites] = useState<MinutesInvitation[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteMeeting, setDeleteMeeting] = useState<MinutesMeeting | null>(null);
  const [yearFilter, setYearFilter] = useState(() => String(currentJalaliYear()));

  const companyGroups = useMemo(
    () => groups.filter((row) => (companyId ? row.company === companyId : true)),
    [groups, companyId],
  );
  const selectedGroup = companyGroups.find((row) => row.id === groupId) ?? null;
  const groupMeetings = useMemo(
    () => (groupId ? meetings.filter((row) => row.group === groupId) : []),
    [meetings, groupId],
  );
  const thisYear = currentJalaliYear();
  const yearOptions = useMemo(() => {
    const years = new Set(groupMeetings.map((row) => row.year).filter(Boolean));
    years.add(thisYear);
    return [...years].sort((a, b) => b - a);
  }, [groupMeetings, thisYear]);
  const visibleMeetings = useMemo(() => {
    if (yearFilter === "all") return groupMeetings;
    const year = Number(yearFilter);
    return groupMeetings.filter((row) => row.year === year);
  }, [groupMeetings, yearFilter]);
  const canCreate = Boolean(selectedGroup?.can_manage);

  const applyContext = useCallback(
    (companyRows: MinutesCompany[], groupRows: MinutesGroup[]) => {
      const stored = readContext();
      const storedCompany = companyRows.find((row) => row.id === stored.companyId);
      const nextCompany = storedCompany ?? companyRows[0] ?? null;
      const inCompany = groupRows.filter((row) => (nextCompany ? row.company === nextCompany.id : true));
      const storedGroup = inCompany.find((row) => row.id === stored.groupId);
      const nextGroup =
        storedGroup ?? inCompany.find((row) => row.is_default) ?? inCompany[0] ?? null;
      setCompanyId(nextCompany?.id ?? null);
      setGroupId(nextGroup?.id ?? null);
      writeContext(nextCompany?.id ?? null, nextGroup?.id ?? null);
    },
    [],
  );

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
      applyContext(companyRows, groupRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadHomeFail"));
    } finally {
      setLoading(false);
    }
  }, [applyContext, t]);

  useEffect(() => {
    load();
  }, [load]);

  const pickCompany = (id: number) => {
    const inCompany = groups.filter((row) => row.company === id);
    const nextGroup = inCompany.find((row) => row.is_default) ?? inCompany[0] ?? null;
    setCompanyId(id);
    setGroupId(nextGroup?.id ?? null);
    writeContext(id, nextGroup?.id ?? null);
  };

  const pickGroup = (id: number) => {
    const group = groups.find((row) => row.id === id);
    const nextCompany = group?.company ?? companyId;
    setCompanyId(nextCompany);
    setGroupId(id);
    writeContext(nextCompany, id);
  };

  const createCompany = async () => {
    if (!companyName.trim()) {
      setFormError(t("minutes.companyRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await apiFetch<MinutesCompany>("/minutes/companies/", {
        method: "POST",
        body: { name: companyName.trim() },
      });
      setCompanyOpen(false);
      setCompanyName("");
      writeContext(created.id, null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.companyFail"));
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    if (!companyId) return;
    if (!groupName.trim()) {
      setFormError(t("minutes.groupRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await apiFetch<MinutesGroup>("/minutes/groups/", {
        method: "POST",
        body: { company: companyId, name: groupName.trim() },
      });
      setGroupOpen(false);
      setGroupName("");
      writeContext(companyId, created.id);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.groupFail"));
    } finally {
      setSaving(false);
    }
  };

  const startMeeting = async () => {
    if (!groupId) return;
    setCreating(true);
    setError(null);
    try {
      const meeting = await apiFetch<MinutesMeeting>("/minutes/meetings/", {
        method: "POST",
        body: { group: groupId },
      });
      router.push(`/minutes/meetings/${meeting.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.meetingFail"));
      setCreating(false);
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

  const removeMeeting = async () => {
    if (!deleteMeeting) return;
    setSaving(true);
    try {
      await apiFetch(`/minutes/meetings/${deleteMeeting.id}/`, { method: "DELETE" });
      setDeleteMeeting(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadMeetingFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const createButton = canCreate ? (
    <Button onClick={startMeeting} loading={creating} className="min-h-11 w-full px-5 text-sm font-bold sm:w-auto">
      <MinutesDocIcon className="size-4" />
      {t("minutes.createMeeting")}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4 pt-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <WorkBreadcrumb fallbackHref="/dashboard" items={[{ label: t("minutes.crumb") }]} />
          <h1 className="text-base font-bold text-ink">{t("minutes.title")}</h1>
        </div>
        <Link href="/minutes/inbox">
          <Button variant="secondary" size="sm">
            <InboxIcon className="size-4" />
            {t("minutes.inbox")}
            {invites.length > 0 ? ` (${n(invites.length)})` : ""}
          </Button>
        </Link>
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

      {companies.length === 0 ? (
        <EmptyState
          title={t("minutes.noCompanyTitle")}
          description={t("minutes.noCompanyDesc")}
          action={
            <Button size="sm" onClick={() => setCompanyOpen(true)}>
              <PlusIcon className="size-4" />
              {t("minutes.firstCompany")}
            </Button>
          }
        />
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MinutesIconTile tone="navy" size="sm">
              <SettingsIcon className="size-4" />
            </MinutesIconTile>
            <p className="text-sm font-bold text-ink">{t("minutes.settings")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("minutes.company")}>
              <div className="flex items-center gap-2">
                <MinutesIconTile tone="soft" size="sm">
                  <CompanyIcon className="size-4" />
                </MinutesIconTile>
                <Select
                  className="min-h-11 min-w-0 flex-1"
                  value={companyId ?? ""}
                  onChange={(event) => pickCompany(Number(event.target.value))}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label={t("minutes.group")}>
              <div className="flex items-center gap-2">
                <MinutesIconTile tone="brand" size="sm">
                  <GroupIcon className="size-4" />
                </MinutesIconTile>
                <Select
                  className="min-h-11 min-w-0 flex-1"
                  value={groupId ?? ""}
                  onChange={(event) => pickGroup(Number(event.target.value))}
                  disabled={companyGroups.length === 0}
                >
                  {companyGroups.length === 0 ? (
                    <option value="">{t("minutes.noGroupTitle")}</option>
                  ) : (
                    companyGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.is_default ? "★ " : ""}
                        {group.name}
                      </option>
                    ))
                  )}
                </Select>
              </div>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selectedGroup ? (
              <DefaultSwitch
                on={selectedGroup.is_default}
                disabled={busyId === selectedGroup.id || !selectedGroup.can_edit}
                name={selectedGroup.name}
                onToggle={() => setDefault(selectedGroup)}
              />
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setCompanyOpen(true)}>
              <PlusIcon className="size-4" />
              {t("minutes.newCompany")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setGroupOpen(true)} disabled={!companyId}>
              <PlusIcon className="size-4" />
              {t("minutes.newGroup")}
            </Button>
            {selectedGroup ? (
              <Link href={`/minutes/groups/${selectedGroup.id}`}>
                <Button size="sm" variant="ghost">
                  <GroupIcon className="size-4" />
                  {t("minutes.manageGroup")}
                </Button>
              </Link>
            ) : null}
            {companyId ? (
              <Link href="/minutes/companies">
                <Button size="sm" variant="ghost">
                  <SettingsIcon className="size-4" />
                  {t("minutes.manageCompany")}
                </Button>
              </Link>
            ) : null}
          </div>
        </section>
      )}

      {companies.length > 0 && companyGroups.length === 0 ? (
        <EmptyState
          title={t("minutes.noGroupTitle")}
          description={t("minutes.noGroupDesc")}
          action={
            <Button size="sm" onClick={() => setGroupOpen(true)}>
              <PlusIcon className="size-4" />
              {t("minutes.firstGroup")}
            </Button>
          }
        />
      ) : null}

      {selectedGroup ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink">{t("minutes.meetings")}</h2>
              <p className="text-[11px] text-gray-500">
                {selectedGroup.company_name} · {selectedGroup.name}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 sm:flex-none">
                <span className="whitespace-nowrap text-xs font-semibold text-navy-800">{t("minutes.year")}</span>
                <Select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="min-h-10 min-w-[8rem]"
                >
                  <option value="all">{t("minutes.yearAll")}</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {formatJalaliYear(year, locale === "en")}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="w-full sm:w-auto">{createButton}</div>
            </div>
          </div>

          <MinutesMeetingsTable
            meetings={visibleMeetings}
            onDelete={(meeting) => setDeleteMeeting(meeting)}
            empty={
              <EmptyState
                title={t("minutes.noMeetingTitle")}
                description={t("minutes.noMeetingDesc")}
                action={createButton ?? undefined}
              />
            }
          />

          {visibleMeetings.length > 4 && createButton ? (
            <div className="flex justify-end">{createButton}</div>
          ) : null}
        </section>
      ) : null}

      <Modal open={companyOpen} title={t("minutes.newCompany")} onClose={() => setCompanyOpen(false)}>
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
              <PlusIcon className="size-4" />
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={groupOpen} title={t("minutes.newGroup")} onClose={() => setGroupOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("minutes.groupName")}>
            <Input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGroupOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createGroup}>
              <PlusIcon className="size-4" />
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleteMeeting !== null}
        title={t("minutes.deleteMeeting")}
        description={t("minutes.deleteMeetingConfirm")}
        loading={saving}
        onCancel={() => setDeleteMeeting(null)}
        onConfirm={removeMeeting}
      />
    </div>
  );
}
