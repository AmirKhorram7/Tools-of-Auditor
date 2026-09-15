"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CompanyIcon,
  MinutesIconTile,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/minutes/MinutesIcons";
import { MinutesLogo, MinutesLogoPicker } from "@/components/minutes/MinutesLogo";
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageLoader,
} from "@/components/ui";
import { formatJalaliDisplay } from "@/components/work/JalaliDateField";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MinutesCompany, MinutesGroup } from "@/lib/minutes";

export default function CompaniesSettings({ focusId }: { focusId?: number }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const latin = locale === "en";
  const [companies, setCompanies] = useState<MinutesCompany[]>([]);
  const [groups, setGroups] = useState<MinutesGroup[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<MinutesCompany | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<MinutesCompany | null>(null);
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRows, groupRows] = await Promise.all([
        apiList<MinutesCompany>("/minutes/companies/"),
        apiList<MinutesGroup>("/minutes/groups/"),
      ]);
      setCompanies(companyRows);
      setGroups(groupRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadCompanyFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? companies.filter((row) => row.name.toLowerCase().includes(needle))
      : companies;
    if (!focusId) return rows;
    return [...rows].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));
  }, [companies, query, focusId]);

  const createCompany = async () => {
    if (!name.trim()) {
      setFormError(t("minutes.companyRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let created: MinutesCompany;
      if (logoFile) {
        const payload = new FormData();
        payload.append("name", name.trim());
        payload.append("logo", logoFile);
        created = await apiFetch<MinutesCompany>("/minutes/companies/", {
          method: "POST",
          formData: payload,
        });
      } else {
        created = await apiFetch<MinutesCompany>("/minutes/companies/", {
          method: "POST",
          body: { name: name.trim() },
        });
      }
      setCreateOpen(false);
      setName("");
      setLogoFile(null);
      await load();
      router.replace(`/minutes/companies/${created.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.companyFail"));
    } finally {
      setSaving(false);
    }
  };

  const saveCompany = async () => {
    if (!editCompany) return;
    if (!name.trim()) {
      setFormError(t("minutes.companyRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (logoFile) {
        const payload = new FormData();
        payload.append("name", name.trim());
        payload.append("logo", logoFile);
        await apiFetch(`/minutes/companies/${editCompany.id}/`, {
          method: "PATCH",
          formData: payload,
        });
      } else {
        await apiFetch(`/minutes/companies/${editCompany.id}/`, {
          method: "PATCH",
          body: { name: name.trim() },
        });
      }
      setEditCompany(null);
      setLogoFile(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.companyFail"));
    } finally {
      setSaving(false);
    }
  };

  const removeCompany = async () => {
    if (!deleteCompany) return;
    setSaving(true);
    try {
      await apiFetch(`/minutes/companies/${deleteCompany.id}/`, { method: "DELETE" });
      setDeleteCompany(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.companyFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4 pt-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MinutesIconTile tone="navy">
            <CompanyIcon />
          </MinutesIconTile>
          <div className="min-w-0">
            <WorkBreadcrumb
              fallbackHref="/minutes"
              items={[
                { href: "/minutes", label: t("minutes.crumb") },
                { label: t("minutes.manageCompany") },
              ]}
            />
            <h1 className="text-base font-bold text-ink">{t("minutes.manageCompany")}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setName("");
            setLogoFile(null);
            setFormError(null);
            setCreateOpen(true);
          }}
          className="flex size-12 items-center justify-center rounded-full bg-brand-500 text-navy-900 shadow-sm transition hover:bg-brand-700 hover:text-white"
          title={t("minutes.newCompany")}
        >
          <PlusIcon className="size-6" />
        </button>
      </div>

      {error && <Alert>{error}</Alert>}

      {companies.length > 1 ? (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <SearchIcon className="size-4 shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("minutes.filterCompany")}
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-gray-400"
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyCreate
          title={t("minutes.noCompanyTitle")}
          actionLabel={t("minutes.firstCompany")}
          onClick={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-4">
          {visible.map((company) => {
            const related = groups.filter((row) => row.company === company.id);
            const focused = company.id === focusId;
            return (
              <section
                key={company.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                  focused ? "border-brand-500" : "border-gray-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                    <MinutesLogo
                      src={company.logo}
                      name={company.name}
                      size={160}
                      kind="company"
                      id={company.id}
                      className="!size-24 rounded-[1.25rem] sm:!size-40 sm:rounded-[1.75rem]"
                    />
                    <div className="min-w-0 pt-1">
                      <h1 className="text-xl font-bold leading-8 text-ink">{company.name}</h1>
                      <p className="mt-2 flex items-center gap-2 text-sm leading-6 text-gray-600">
                        <CompanyIcon className="size-4 text-navy-800" />
                        {t("minutes.owner")}: {company.owner_name || "—"}
                      </p>
                      <p className="text-sm leading-6 text-gray-600">
                        {t("minutes.createdAt")}: {formatJalaliDisplay(company.created_at, latin)}
                      </p>
                    </div>
                  </div>
                  {company.is_owner ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditCompany(company);
                          setName(company.name);
                          setLogoFile(null);
                          setFormError(null);
                        }}
                      >
                        <PencilIcon className="size-4" />
                        {t("common.edit")}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteCompany(company)}>
                        <TrashIcon className="size-4" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-semibold text-navy-800">{t("minutes.relatedGroups")}</p>
                  {related.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("minutes.noRelatedGroups")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {related.map((group) => (
                        <Link
                          key={group.id}
                          href={`/minutes/groups/${group.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-navy-400"
                        >
                          <MinutesLogo
                            src={group.logo}
                            name={group.name}
                            size={22}
                            kind="group"
                            id={group.id}
                            className="rounded-full"
                          />
                          {group.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        title={t("minutes.newCompany")}
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <MinutesLogoPicker src={null} name={name} kind="company" id={1} onFile={setLogoFile} />
          <Field label={t("minutes.companyName")}>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCompany()}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createCompany}>
              <PlusIcon className="size-4" />
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editCompany !== null}
        title={t("minutes.editCompany")}
        onClose={() => setEditCompany(null)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          {editCompany ? (
            <MinutesLogoPicker
              src={editCompany.logo}
              name={name || editCompany.name}
              kind="company"
              id={editCompany.id}
              onFile={setLogoFile}
            />
          ) : null}
          <Field label={t("minutes.companyName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditCompany(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={saveCompany}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteCompany !== null}
        title={t("minutes.deleteCompany")}
        description={t("minutes.deleteCompanyConfirm")}
        loading={saving}
        onCancel={() => setDeleteCompany(null)}
        onConfirm={removeCompany}
      />
    </div>
  );
}

function EmptyCreate({
  title,
  actionLabel,
  onClick,
}: {
  title: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="mt-4 flex justify-center">
        <Button size="sm" onClick={onClick}>
          <PlusIcon className="size-4" />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
