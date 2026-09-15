"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import DefaultSwitch from "@/components/minutes/DefaultSwitch";
import {
  GroupIcon,
  MinutesIconTile,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
} from "@/components/minutes/MinutesIcons";
import { MinutesLogo, MinutesLogoPicker } from "@/components/minutes/MinutesLogo";
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
  cx,
} from "@/components/ui";
import PhoneSuggest from "@/components/work/PhoneSuggest";
import { formatJalaliDisplay } from "@/components/work/JalaliDateField";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ASSIGNABLE_ROLES,
  type MinutesGroup,
  type MinutesMember,
} from "@/lib/minutes";

export default function MinutesGroupPage() {
  const params = useParams<{ id: string }>();
  const groupId = Number(params.id);
  const router = useRouter();
  const { t, locale } = useI18n();
  const latin = locale === "en";

  const [group, setGroup] = useState<MinutesGroup | null>(null);
  const [members, setMembers] = useState<MinutesMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeMember, setRemoveMember] = useState<MinutesMember | null>(null);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("guest");
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(groupId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, memberRows] = await Promise.all([
        apiFetch<MinutesGroup>(`/minutes/groups/${groupId}/`),
        apiFetch<MinutesMember[]>(`/minutes/groups/${groupId}/members/`),
      ]);
      setGroup(row);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
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

  const saveGroup = async () => {
    if (!editName.trim()) {
      setFormError(t("minutes.groupRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (logoFile) {
        const payload = new FormData();
        payload.append("name", editName.trim());
        payload.append("logo", logoFile);
        await apiFetch(`/minutes/groups/${groupId}/`, { method: "PATCH", formData: payload });
      } else {
        await apiFetch(`/minutes/groups/${groupId}/`, {
          method: "PATCH",
          body: { name: editName.trim() },
        });
      }
      setEditOpen(false);
      setLogoFile(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.groupFail"));
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    if (!group) return;
    if (!newName.trim()) {
      setFormError(t("minutes.groupRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await apiFetch<MinutesGroup>("/minutes/groups/", {
        method: "POST",
        body: { company: group.company, name: newName.trim() },
      });
      setCreateOpen(false);
      setNewName("");
      router.push(`/minutes/groups/${created.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("minutes.groupFail"));
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async () => {
    setSaving(true);
    try {
      await apiFetch(`/minutes/groups/${groupId}/`, { method: "DELETE" });
      router.push("/minutes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.groupFail"));
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async () => {
    if (!removeMember) return;
    setSaving(true);
    try {
      await apiFetch(`/minutes/groups/${groupId}/members/${removeMember.id}/`, {
        method: "DELETE",
      });
      setRemoveMember(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.inviteFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!group) return <Alert>{t("minutes.notFound")}</Alert>;

  const canManage = Boolean(group.can_manage);
  const canEdit = Boolean(group.can_edit);

  return (
    <div className="flex flex-col gap-4 pt-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <MinutesIconTile tone="brand">
            <GroupIcon />
          </MinutesIconTile>
          <WorkBreadcrumb
            fallbackHref="/minutes"
            items={[
              { href: "/minutes", label: t("minutes.crumb") },
              { href: `/minutes/companies/${group.company}`, label: group.company_name || t("minutes.company") },
              { label: group.name },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
              <UserPlusIcon className="size-4" />
              {t("minutes.invite")}
            </Button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setNewName("");
                setFormError(null);
                setCreateOpen(true);
              }}
              className="flex size-11 items-center justify-center rounded-full bg-brand-500 text-navy-900 shadow-sm transition hover:bg-brand-700 hover:text-white"
              title={t("minutes.newGroup")}
            >
              <PlusIcon className="size-5" />
            </button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <MinutesLogo
              src={group.logo}
              name={group.name}
              size={120}
              kind="group"
              id={group.id}
              className="!size-20 sm:!size-[7.5rem]"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-8 text-ink">{group.name}</h1>
              <p className="mt-1 text-sm leading-6 text-gray-600">{group.company_name}</p>
              <p className="text-sm leading-6 text-gray-600">
                {t("minutes.owner")}: {group.owner_name || "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DefaultSwitch
              on={group.is_default}
              disabled={busy || !canEdit}
              name={group.name}
              onToggle={toggleDefault}
            />
            {canEdit ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditName(group.name);
                    setLogoFile(null);
                    setFormError(null);
                    setEditOpen(true);
                  }}
                >
                  <PencilIcon className="size-4" />
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                  <TrashIcon className="size-4" />
                  {t("common.delete")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-navy-800/10 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <MinutesIconTile tone="navy" size="sm">
            <GroupIcon className="size-4" />
          </MinutesIconTile>
          <h2 className="text-sm font-bold text-ink">{t("minutes.members")}</h2>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-navy-900 text-white">
            <tr>
              <th className="px-3 py-3 text-start text-xs font-semibold">{t("minutes.members")}</th>
              <th className="px-3 py-3 text-start text-xs font-semibold">{t("minutes.inviteRole")}</th>
              <th className="px-3 py-3 text-start text-xs font-semibold">{t("minutes.joinedAt")}</th>
              {canManage ? (
                <th className="px-3 py-3 text-start text-xs font-semibold">{t("minutes.actions")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => {
              const isOwner = member.role === "owner";
              return (
                <tr
                  key={member.id}
                  className={index % 2 === 0 ? "bg-white" : "bg-[#f4f7f9]"}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={member.profile_image} name={member.full_name} size={40} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{member.full_name}</p>
                        <p className="text-[11px] text-gray-500" dir="ltr">
                          {member.phone_number}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cx(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        member.role === "owner"
                          ? "bg-navy-900 text-white"
                          : member.role === "maintainer"
                            ? "bg-brand-500 text-ink"
                            : "bg-green-100 text-green-800",
                      )}
                    >
                      {t(`minutes.role.${member.role}`)}
                    </span>
                    {member.position_title ? (
                      <p className="mt-1 text-[11px] text-gray-500">{member.position_title}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-ink">
                    {formatJalaliDisplay(member.joined_at, latin) || "—"}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-3">
                      {!isOwner ? (
                        <button
                          type="button"
                          className="flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-red-50 hover:text-red-600"
                          aria-label={t("minutes.removeMember")}
                          onClick={() => setRemoveMember(member)}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {members.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">{t("minutes.noMembers")}</p>
        ) : null}
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
              <UserPlusIcon className="size-4" />
              {t("minutes.invite")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={createOpen} title={t("minutes.newGroup")} onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("minutes.groupName")}>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createGroup}>
              <PlusIcon className="size-4" />
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title={t("minutes.editGroup")} onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <MinutesLogoPicker
            src={group.logo}
            name={editName || group.name}
            kind="group"
            id={group.id}
            onFile={setLogoFile}
          />
          <Field label={t("minutes.groupName")}>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={saveGroup}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title={t("minutes.deleteGroup")}
        description={t("minutes.deleteGroupConfirm")}
        loading={saving}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={removeGroup}
      />
      <ConfirmDialog
        open={removeMember !== null}
        title={t("minutes.removeMember")}
        description={t("minutes.removeMemberConfirm")}
        loading={saving}
        onCancel={() => setRemoveMember(null)}
        onConfirm={deleteMember}
      />
    </div>
  );
}
