"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert, Avatar, Badge, Button, Card, EmptyState, Field, Input, Textarea } from "@/components/ui";
import JalaliDateField from "@/components/work/JalaliDateField";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import {
  INVITE_STATUS_LABELS,
  notificationHref,
  type WorkInvitation,
  type WorkTimeline,
  type WorkTimelineItem,
} from "@/lib/work";

type Tab = "info" | "invites" | "activity";

type FormState = {
  first_name: string;
  last_name: string;
  bio: string;
  birth_date: string;
  company_name: string;
  job_title: string;
};

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  bio: "",
  birth_date: "",
  company_name: "",
  job_title: "",
};

export default function ProfilePage() {
  const { profile, setProfile, refreshProfile } = useAuth();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  // Only true after the API explicitly says the user already set a password.
  const [hasPassword, setHasPassword] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [invites, setInvites] = useState<WorkInvitation[]>([]);
  const [activity, setActivity] = useState<WorkTimelineItem[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sideError, setSideError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      refreshProfile().catch(() => setError("دریافت پروفایل ناموفق بود."));
      return;
    }
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      bio: profile.bio ?? "",
      birth_date: profile.birth_date ?? "",
      company_name: profile.company_name ?? "",
      job_title: profile.job_title ?? "",
    });
    setHasPassword(profile.has_password === true);
  }, [profile, refreshProfile]);

  useEffect(() => {
    apiList<WorkInvitation>("/work/invitations/")
      .then(setInvites)
      .catch(() => setInvites([]));
    apiFetch<WorkTimeline>("/work/dashboard/timeline/")
      .then((data) => setActivity(data.activity || data.items || []))
      .catch(() => setActivity([]));
  }, []);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const previewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let updated: Profile;

      if (imageFile) {
        const payload = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          if (key === "birth_date" && !value) return;
          payload.append(key, value);
        });
        payload.append("profile_image", imageFile);
        updated = await apiFetch<Profile>("/profile/", {
          method: "PATCH",
          formData: payload,
        });
      } else {
        const body: Record<string, string | null> = { ...form };
        if (!body.birth_date) body.birth_date = null;
        updated = await apiFetch<Profile>("/profile/", {
          method: "PATCH",
          body,
        });
      }

      setProfile(updated);
      setImageFile(null);
      await refreshProfile().catch(() => undefined);
      setSuccess("پروفایل با موفقیت ذخیره شد.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ذخیره پروفایل ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (password.length < 8) {
      setPasswordError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }

    setSavingPassword(true);
    try {
      // Always re-check with the server — never trust a stale has_password flag.
      const latest = await apiFetch<Profile>("/profile/");
      const needsCurrent = latest.has_password === true;
      setHasPassword(needsCurrent);
      setProfile(latest);

      if (needsCurrent && !currentPassword) {
        setPasswordError("رمز عبور فعلی را وارد کنید.");
        return;
      }

      await apiFetch<{ message: string; has_password: boolean }>(
        "/auth/set-password/",
        {
          method: "POST",
          body: {
            password,
            confirm_password: confirmPassword,
            ...(needsCurrent ? { current_password: currentPassword } : {}),
          },
        },
      );
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setHasPassword(true);
      setPasswordSuccess(
        needsCurrent
          ? "رمز عبور با موفقیت تغییر کرد."
          : "رمز عبور ذخیره شد. از این پس می‌توانید با رمز عبور وارد شوید.",
      );
      await refreshProfile().catch(() => undefined);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : "ذخیره رمز عبور ناموفق بود.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const respond = async (id: number, accept: boolean) => {
    setBusyId(id);
    setSideError(null);
    try {
      await apiFetch(`/work/invitations/${id}/${accept ? "accept" : "reject"}/`, {
        method: "POST",
      });
      setInvites(await apiList<WorkInvitation>("/work/invitations/"));
    } catch (err) {
      setSideError(err instanceof ApiError ? err.message : "پاسخ به دعوت ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  };

  const pendingInvites = invites.filter((row) => row.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">پروفایل من</h1>
        <p className="mt-1 text-sm text-gray-500">
          مشخصات، دعوت‌ها و فعالیت کار در یک جا.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <TabBtn active={tab === "info"} label="مشخصات" onClick={() => setTab("info")} />
        <TabBtn
          active={tab === "invites"}
          label={pendingInvites.length > 0 ? `دعوت‌ها (${pendingInvites.length})` : "دعوت‌ها"}
          onClick={() => setTab("invites")}
        />
        <TabBtn
          active={tab === "activity"}
          label="فعالیت"
          onClick={() => setTab("activity")}
        />
      </div>

      {tab === "invites" && (
        <section className="space-y-3">
          {sideError && <Alert>{sideError}</Alert>}
          {pendingInvites.length === 0 ? (
            <EmptyState
              title="دعوت بازی ندارید"
              description="دعوت به تیم اینجا دیده می‌شود."
            />
          ) : (
            pendingInvites.map((invite) => (
              <Card key={invite.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{invite.team_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      از طرف {invite.invited_by_name}
                      {invite.position_title ? ` · ${invite.position_title}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, false)}
                    >
                      رد
                    </Button>
                    <Button
                      size="sm"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, true)}
                    >
                      پذیرش
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
          {invites.some((row) => row.status !== "pending") && (
            <p className="text-xs text-gray-400">
              قبلی:{" "}
              {invites
                .filter((row) => row.status !== "pending")
                .slice(0, 6)
                .map(
                  (row) =>
                    `${row.team_name} (${INVITE_STATUS_LABELS[row.status] || row.status})`,
                )
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      {tab === "activity" && (
        <section>
          {activity.length === 0 ? (
            <EmptyState title="هنوز فعالیتی نیست" description="کار و پروژه اینجا ثبت می‌شود." />
          ) : (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={notificationHref(item)}
                    className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-brand-500"
                  >
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "info" && (
        <>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            src={previewUrl ?? profile?.profile_image}
            name={`${form.first_name} ${form.last_name}`.trim() || "کاربر"}
            size={64}
          />
          <div>
            <p className="text-sm font-medium text-ink">تصویر پروفایل</p>
            <p className="mb-2 text-xs text-gray-500">
              فرمت‌های JPG یا PNG، حداکثر چند مگابایت
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="text-xs text-gray-600"
            />
          </div>
          <div className="ms-auto space-y-1 text-end">
            <p className="text-xs text-gray-500">شماره موبایل (ورود)</p>
            <p dir="ltr" className="text-sm font-medium text-ink">
              {profile?.phone_number ?? "—"}
            </p>
            {hasPassword ? (
              <Badge tone="green">رمز عبور فعال است</Badge>
            ) : (
              <Badge tone="amber">رمز عبور تنظیم نشده</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام">
              <Input
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
                placeholder="نام"
              />
            </Field>
            <Field label="نام خانوادگی">
              <Input
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
                placeholder="نام خانوادگی"
              />
            </Field>
            <Field label="نام شرکت / سازمان">
              <Input
                value={form.company_name}
                onChange={(event) => update("company_name", event.target.value)}
                placeholder="مثال: شرکت دوشه"
              />
            </Field>
            <Field label="عنوان شغلی">
              <Input
                value={form.job_title}
                onChange={(event) => update("job_title", event.target.value)}
                placeholder="مثال: حسابرس داخلی ارشد"
              />
            </Field>
            <Field label="تاریخ تولد">
              <JalaliDateField
                value={form.birth_date}
                onChange={(iso) => update("birth_date", iso)}
              />
            </Field>
          </div>

          <Field label="درباره من">
            <Textarea
              rows={4}
              value={form.bio}
              onChange={(event) => update("bio", event.target.value)}
              placeholder="سابقه کاری و حوزه تخصصی شما"
            />
          </Field>

          {error && <Alert>{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              ذخیره تغییرات
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink">
            {hasPassword ? "تغییر رمز عبور" : "تعیین رمز عبور"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {hasPassword
              ? "رمز عبور فعلی را وارد کنید و رمز جدید بسازید."
              : "با ساخت رمز عبور می‌توانید بدون پیامک و فقط با شماره موبایل وارد شوید."}
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            savePassword();
          }}
        >
          {hasPassword && (
            <Field label="رمز عبور فعلی">
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                dir="ltr"
                autoComplete="current-password"
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رمز عبور جدید" hint="حداقل ۸ کاراکتر">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                dir="ltr"
                autoComplete="new-password"
              />
            </Field>
            <Field label="تکرار رمز عبور جدید">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                dir="ltr"
                autoComplete="new-password"
              />
            </Field>
          </div>

          {passwordError && <Alert>{passwordError}</Alert>}
          {passwordSuccess && <Alert tone="success">{passwordSuccess}</Alert>}

          <div className="flex justify-end">
            <Button type="submit" loading={savingPassword}>
              {hasPassword ? "تغییر رمز عبور" : "ذخیره رمز عبور"}
            </Button>
          </div>
        </form>
      </Card>
        </>
      )}
    </div>
  );
}

function TabBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${
        active
          ? "border-brand-500 bg-brand-500 font-semibold text-ink"
          : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
