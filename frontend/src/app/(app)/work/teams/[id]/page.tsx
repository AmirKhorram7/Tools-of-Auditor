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
import {
  ASSIGNABLE_TEAM_ROLES,
  TEAM_ROLE_LABELS,
  labelTextColor,
  teamColor,
  type WorkTeam,
  type WorkTeamMember,
} from "@/lib/work";

export default function WorkTeamPage() {
  const params = useParams<{ id: string }>();
  const teamId = Number(params.id);

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
      setError(err instanceof ApiError ? err.message : "بارگذاری تیم ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = Boolean(team?.can_manage);

  const saveTeam = async () => {
    if (!name.trim()) {
      setFormError("نام تیم الزامی است.");
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
      setFormError(err instanceof ApiError ? err.message : "ذخیره تیم ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!invitePhone.trim()) {
      setFormError("شماره موبایل الزامی است.");
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
      setFormError(err instanceof ApiError ? err.message : "ارسال دعوت ناموفق بود.");
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
      setFormError(err instanceof ApiError ? err.message : "ذخیره عضو ناموفق بود.");
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
      setError(err instanceof ApiError ? err.message : "حذف عضو ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!team) return <Alert>{error || "تیم پیدا نشد."}</Alert>;

  return (
    <div className="space-y-4">
      <WorkBreadcrumb
        fallbackHref={`/work/companies/${team.company}`}
        items={[
          { href: "/work", label: "کار" },
          {
            href: `/work/companies/${team.company}`,
            label: team.company_name || "شرکت",
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
                {team.company_name || "شرکت"} · {members.length} عضو
              </p>
            </div>
            <Badge tone={team.status === "active" ? "green" : "gray"}>
              {team.status === "active" ? "فعال" : "بایگانی"}
            </Badge>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => { setFormError(null); setInviteOpen(true); }}>
              دعوت همکار
            </Button>
          )}
        </div>
        {canManage ? (
          <div className="border-t border-black/[0.05] bg-[#F7F8FA] px-3 py-2.5">
            {formError && !inviteOpen && !editMember && <Alert>{formError}</Alert>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <Field label="نام تیم">
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
                  فعال
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("archived")}
                  className={`rounded-md px-2.5 py-1.5 ${
                    status === "archived" ? "bg-navy-900 text-white" : "text-gray-600"
                  }`}
                >
                  بایگانی
                </button>
              </div>
              <Button size="sm" loading={saving} onClick={saveTeam}>
                ذخیره
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-black/[0.05] px-3 py-2 text-xs text-gray-500">
            اعضای تیم را می‌بینید؛ تغییر فقط با مدیر است.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">اعضای تیم</h2>
        {members.length === 0 ? (
          <EmptyState
            title="هنوز عضوی نیست"
            description={
              canManage
                ? "همکار را با شماره موبایل دعوت کنید."
                : "وقتی مدیر کسی را دعوت کند، اینجا دیده می‌شود."
            }
          />
        ) : (
          <WorkTable
            columns={
              canManage
                ? ["نام", "نقش", "موبایل", "سمت", "وضعیت", ""]
                : ["نام", "نقش", "موبایل", "سمت", "وضعیت"]
            }
          >
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-surface">
                <WorkTd>
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={member.profile_image}
                      name={member.full_name || member.phone_number}
                      size={36}
                    />
                    <span className="font-semibold text-navy-900">
                      {member.full_name || member.phone_number}
                    </span>
                  </div>
                </WorkTd>
                <WorkTd>
                  {TEAM_ROLE_LABELS[member.role] || member.role || "توسعه‌دهنده"}
                </WorkTd>
                <WorkTd>
                  <span dir="ltr">{member.phone_number}</span>
                </WorkTd>
                <WorkTd>{member.position_title || "—"}</WorkTd>
                <WorkTd>
                  <Badge tone={member.status === "active" ? "green" : "gray"}>
                    {member.status === "active" ? "فعال" : "غیرفعال"}
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
                        ویرایش
                      </Button>
                      {member.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void removeMember(member)}
                        >
                          حذف
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
        title="دعوت به تیم"
        onClose={() => setInviteOpen(false)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label="شماره موبایل">
            <PhoneSuggest value={invitePhone} onChange={setInvitePhone} />
          </Field>
          <Field label="نقش">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {ASSIGNABLE_TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {TEAM_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="سمت (اختیاری)">
            <Input
              value={inviteTitle}
              onChange={(e) => setInviteTitle(e.target.value)}
              placeholder="مثلاً حسابدار"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={sendInvite}>
              ارسال دعوت
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editMember)}
        title="ویرایش عضو"
        onClose={() => setEditMember(null)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <div className="flex items-center gap-3">
            <Avatar
              src={editMember?.profile_image}
              name={editMember?.full_name || editMember?.phone_number || "کاربر"}
              size={40}
            />
            <p className="text-sm font-medium text-ink">
              {editMember?.full_name || editMember?.phone_number}
            </p>
          </div>
          <Field label="نقش">
            <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
              {memberRole === "owner" && <option value="owner">{TEAM_ROLE_LABELS.owner}</option>}
              {ASSIGNABLE_TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {TEAM_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="سمت">
            <Input
              value={memberTitle}
              onChange={(e) => setMemberTitle(e.target.value)}
            />
          </Field>
          <Field label="وضعیت">
            <Select
              value={memberStatus}
              onChange={(e) => setMemberStatus(e.target.value)}
            >
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditMember(null)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={saveMember}>
              ذخیره
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
