"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "@/lib/minutes";

export default function MinutesCompanyPage() {
  const params = useParams<{ id: string }>();
  const companyId = Number(params.id);
  const { t, n } = useI18n();
  const [company, setCompany] = useState<MinutesCompany | null>(null);
  const [groups, setGroups] = useState<MinutesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(companyId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, groupRows] = await Promise.all([
        apiFetch<MinutesCompany>(`/minutes/companies/${companyId}/`),
        apiList<MinutesGroup>(`/minutes/groups/?company=${companyId}`),
      ]);
      setCompany(row);
      setGroups(groupRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadCompanyFail"));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const createGroup = async () => {
    if (!groupName.trim()) {
      setFormError(t("minutes.groupRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/minutes/groups/", {
        method: "POST",
        body: { company: companyId, name: groupName.trim() },
      });
      setGroupOpen(false);
      setGroupName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.groupFail"));
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
  if (!company) {
    return <Alert>{t("minutes.notFound")}</Alert>;
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkBreadcrumb
          fallbackHref="/minutes"
          items={[
            { href: "/minutes", label: t("minutes.crumb") },
            { label: company.name },
          ]}
        />
        {company.is_owner && (
          <Button size="sm" onClick={() => setGroupOpen(true)}>
            + {t("minutes.newGroup")}
          </Button>
        )}
      </div>

      <WorkPhotoCard
        href={`/minutes/companies/${company.id}`}
        imageSrc={minutesCompanyPhoto(company.id)}
        className="w-full max-w-xl pointer-events-none"
      >
        <p className="text-base font-bold text-ink">{company.name}</p>
        <p className="mt-1 text-[11px] text-navy-800">
          {t("minutes.groupCardMeta", { members: n(groups.length) })}
        </p>
      </WorkPhotoCard>

      {error && <Alert>{error}</Alert>}

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">👥 {t("minutes.groups")}</h2>
        {groups.length === 0 ? (
          <EmptyState
            title={t("minutes.noGroupTitle")}
            description={t("minutes.noGroupDesc")}
            action={
              company.is_owner ? (
                <Button size="sm" onClick={() => setGroupOpen(true)}>
                  {t("minutes.firstGroup")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm"
              >
                <Link href={`/minutes/groups/${group.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {group.is_default ? "⭐ " : ""}
                    {group.name}
                  </p>
                  <p className="text-[11px] text-gray-500">{t(`minutes.role.${group.my_role || "guest"}`)}</p>
                </Link>
                {company.is_owner && (
                  <DefaultSwitch
                    on={group.is_default}
                    disabled={busyId === group.id}
                    onToggle={() => setDefault(group)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
