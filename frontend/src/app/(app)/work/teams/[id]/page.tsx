"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
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
import type { WorkTeam, WorkTeamMember } from "@/lib/work";

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
  const [editMember, setEditMember] = useState<WorkTeamMember | null>(null);
  const [memberTitle, setMemberTitle] = useState("");
  const [memberStatus, setMemberStatus] = useState("active");

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
        },
      });
      setInviteOpen(false);
      setInvitePhone("");
      setInviteTitle("");
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
        body: { position_title: memberTitle.trim(), status: memberStatus },
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">{team.name}</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {canManage ? "عضو اضافه یا حذف کنید." : "فقط مشاهده"}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setFormError(null); setInviteOpen(true); }}>
            دعوت همکار
          </Button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {canManage ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">ویرایش تیم</h2>
          {formError && !inviteOpen && !editMember && <Alert>{formError}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام تیم">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="وضعیت">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">فعال</option>
                <option value="archived">بایگانی</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button size="sm" loading={saving} onClick={saveTeam}>
              ذخیره تیم
            </Button>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-gray-500">اعضای تیم را می‌بینید؛ تغییر فقط با مدیر است.</p>
      )}

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
                ? ["نام", "موبایل", "سمت", "وضعیت", ""]
                : ["نام", "موبایل", "سمت", "وضعیت"]
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
