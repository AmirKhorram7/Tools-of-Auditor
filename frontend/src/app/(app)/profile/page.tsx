"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert, Avatar, Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/types";

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">پروفایل من</h1>
        <p className="mt-1 text-sm text-gray-500">
          اطلاعات حساب کاربری را تکمیل کنید و برای ورود بعدی یک رمز عبور بسازید.
        </p>
      </div>

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
            <Field label="تاریخ تولد" hint="تاریخ میلادی (YYYY-MM-DD)">
              <Input
                type="date"
                value={form.birth_date}
                onChange={(event) => update("birth_date", event.target.value)}
                dir="ltr"
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
    </div>
  );
}
