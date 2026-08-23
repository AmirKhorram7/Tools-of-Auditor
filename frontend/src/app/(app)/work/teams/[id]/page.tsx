"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ASSIGNABLE_TEAM_ROLES,
  labelTextColor,
  teamColor,
  workRoleLabel,
  type WorkTeam,
  type WorkTeamMember,
} from "@/lib/work";

export default function WorkTeamPage() {
  const params = useParams<{ id: string }>();
  const teamId = Number(params.id);
  const { t } = useI18n();

  const [team, setTeam] = useState<WorkTeam | null>(null);
  const [members, setMembers] = useState<WorkTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [editMember, setEditMember] = useState<WorkTeamMember | null>(null);
  const [memberTitle, setMemberTitle] = useState("");
  const [memberStatus, setMemberStatus] = useState("active");
  const [memberRole, setMemberRole] = useState("developer");

  const load = useCallback(async () => {
    if (!Number.isFinite(teamId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, memberRows] = await Promise.all([
        apiFetch<WorkTeam>(`/work/teams/${teamId}/`),
        apiFetch<WorkTeamMember[]>(`/work/teams/${teamId}/members/`),
      ]);
      setTeam(row);
      setName(row.name);
      setStatus(row.status);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadTeamFail"));
    } finally {
      setLoading(false);
    }
  }, [teamId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = Boolean(team?.can_manage);

  const saveTeam = async () => {
    if (!name.trim()) {
      setFormError(t("work.teamRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const updated = await apiFetch<WorkTeam>(`/work/teams/${teamId}/`, {
        method: "PATCH",
        body: { name: name.trim(), status },
      });
      setTeam(updated);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.saveTeamFail"));
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!invitePhone.trim()) {
      setFormError(t("work.phoneRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/teams/${teamId}/invite/`, {
        method: "POST",
        body: {
          phone_number: invitePhone.trim(),
          position_title: inviteTitle.trim(),
          role: inviteRole,
        },
      });
      setInviteOpen(false);
      setInvitePhone("");
      setInviteTitle("");
      setInviteRole("developer");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.sendInviteFail"));
    } finally {
      setSaving(false);
    }
  };

  const saveMember = async () => {
    if (!editMember) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/teams/${teamId}/members/${editMember.id}/`, {
        method: "PATCH",
        body: { position_title: memberTitle.trim(), status: memberStatus, role: memberRole },
      });
      setEditMember(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.saveMemberFail"));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: WorkTeamMember) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/work/teams/${teamId}/members/${member.id}/`, {
        method: "PATCH",
        body: { status: "inactive" },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.deleteMemberFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!team) return <Alert>{error || t("work.teamMissing")}</Alert>;

  return (
    <div className="space-y-4">
      <WorkBreadcrumb
        fallbackHref={`/work/companies/${team.company}`}
        items={[
          { href: "/work", label: t("work.crumb") },
          {
            href: `/work/companies/${team.company}`,
            label: team.company_name || t("work.company"),
          },
          { label: team.name },
        ]}
      />
      {error && <Alert>{error}</Alert>}

      <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{
                backgroundColor: teamColor(team.id),
                color: labelTextColor(teamColor(team.id)),
              }}
            >
              {team.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-ink">{team.name}</h1>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {team.company_name || t("work.company")} · {t("work.membersCount", { count: members.length })}
              </p>
            </div>
            <Badge tone={team.status === "active" ? "green" : "gray"}>
              {team.status === "active" ? t("work.active") : t("work.archived")}
            </Badge>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => { setFormError(null); setInviteOpen(true); }}>
              {t("work.inviteColleague")}
            </Button>
          )}
        </div>
        {canManage ? (
          <div className="border-t border-black/[0.05] bg-[#F7F8FA] px-3 py-2.5">
            {formError && !inviteOpen && !editMember && <Alert>{formError}</Alert>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <Field label={t("work.teamName")}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              </div>
              <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`rounded-md px-2.5 py-1.5 ${
                    status === "active" ? "bg-navy-900 text-white" : "text-gray-600"
                  }`}
                >
                  {t("work.active")}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("archived")}
                  className={`rounded-md px-2.5 py-1.5 ${
                    status === "archived" ? "bg-navy-900 text-white" : "text-gray-600"
                  }`}
                >
                  {t("work.archived")}
                </button>
              </div>
              <Button size="sm" loading={saving} onClick={saveTeam}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-black/[0.05] px-3 py-2 text-xs text-gray-500">
            {t("work.teamViewOnly")}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">{t("work.members")}</h2>
        {members.length === 0 ? (
          <EmptyState
            title={t("work.noMemberTitle")}
            description={
              canManage
                ? t("work.noMemberManage")
                : t("work.noMemberOther")
            }
          />
        ) : (
          <WorkTable
            columns={
              canManage
                ? [t("work.colName"), t("work.colRole"), t("work.colPhone"), t("work.colTitle"), t("common.status"), ""]
                : [t("work.colName"), t("work.colRole"), t("work.colPhone"), t("work.colTitle"), t("common.status")]
            }
          >
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-surface">
                <WorkTd>
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={member.profile_image}
                      name={member.full_name || member.phone_number}
                      size={48}
                    />
                    <span className="font-semibold text-navy-900">
                      {member.full_name || member.phone_number}
                    </span>
                  </div>
                </WorkTd>
                <WorkTd>
                  {workRoleLabel(t, member.role) || member.role || t("work.role.developer")}
                </WorkTd>
                <WorkTd>
                  <span dir="ltr">{member.phone_number}</span>
                </WorkTd>
                <WorkTd>{member.position_title || t("work.none")}</WorkTd>
                <WorkTd>
                  <Badge tone={member.status === "active" ? "green" : "gray"}>
                    {member.status === "active" ? t("work.active") : t("work.inactive")}
                  </Badge>
                </WorkTd>
                {canManage && (
                  <WorkTd>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditMember(member);
                          setMemberTitle(member.position_title || "");
                          setMemberStatus(member.status);
                          setMemberRole(member.role || "developer");
                          setFormError(null);
                        }}
                      >
                        {t("common.edit")}
                      </Button>
                      {member.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void removeMember(member)}
                        >
                          {t("common.delete")}
                        </Button>
                      )}
                    </div>
                  </WorkTd>
                )}
              </tr>
            ))}
          </WorkTable>
        )}
      </section>

      <Modal
        open={inviteOpen}
        title={t("work.inviteTeam")}
        onClose={() => setInviteOpen(false)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.phone")}>
            <PhoneSuggest value={invitePhone} onChange={setInvitePhone} />
          </Field>
          <Field label={t("work.role")}>
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {ASSIGNABLE_TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {workRoleLabel(t, role)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("work.positionOptional")}>
            <Input
              value={inviteTitle}
              onChange={(e) => setInviteTitle(e.target.value)}
              placeholder={t("work.positionExample")}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={sendInvite}>
              {t("work.sendInvite")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editMember)}
        title={t("work.editMember")}
        onClose={() => setEditMember(null)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <div className="flex items-center gap-3">
            <Avatar
              src={editMember?.profile_image}
              name={editMember?.full_name || editMember?.phone_number || t("common.user")}
              size={40}
            />
            <p className="text-sm font-medium text-ink">
              {editMember?.full_name || editMember?.phone_number}
            </p>
          </div>
          <Field label={t("work.role")}>
            <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
              {memberRole === "owner" && <option value="owner">{workRoleLabel(t, "owner")}</option>}
              {ASSIGNABLE_TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {workRoleLabel(t, role)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("work.colTitle")}>
            <Input
              value={memberTitle}
              onChange={(e) => setMemberTitle(e.target.value)}
            />
          </Field>
          <Field label={t("common.status")}>
            <Select
              value={memberStatus}
              onChange={(e) => setMemberStatus(e.target.value)}
            >
              <option value="active">{t("work.active")}</option>
              <option value="inactive">{t("work.inactive")}</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditMember(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={saveMember}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
