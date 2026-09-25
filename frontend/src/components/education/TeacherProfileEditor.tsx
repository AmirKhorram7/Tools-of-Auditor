"use client";

import { useEffect, useState } from "react";

import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { ApiError, apiFetch, mediaUrl } from "@/lib/api";
import type { EduTeacher } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const emptyForm = {
  display_name: "",
  headline: "",
  bio: "",
  website: "",
  linkedin_url: "",
  telegram_url: "",
  instagram_url: "",
  projects_text: "",
};

export default function TeacherProfileEditor() {
  const { t } = useI18n();
  const [form, setForm] = useState(emptyForm);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<EduTeacher>("/education/teacher-profile/")
      .then((row) => {
        setForm({
          display_name: row.display_name || "",
          headline: row.headline || "",
          bio: row.bio || "",
          website: row.website || "",
          linkedin_url: row.linkedin_url || "",
          telegram_url: row.telegram_url || "",
          instagram_url: row.instagram_url || "",
          projects_text: row.projects_text || (row.projects || []).join("\n"),
        });
        setPhotoUrl(row.photo_url || "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t("edu.studioDenied")))
      .finally(() => setLoading(false));
  }, [t]);

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setForm((row) => ({ ...row, [key]: value }));
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (photoFile) payload.append("photo", photoFile);
      const row = await apiFetch<EduTeacher>("/education/teacher-profile/", {
        method: "PUT",
        formData: payload,
      });
      setPhotoUrl(row.photo_url || "");
      setPhotoFile(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.studioDenied"));
    }
  };

  if (loading) return <p className="text-sm text-gray-500">{t("common.loading")}</p>;

  const preview = photoFile ? URL.createObjectURL(photoFile) : mediaUrl(photoUrl);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-ink">{t("edu.teacherPageEdit")}</h2>
      <p className="mt-1 text-xs text-gray-500">{t("edu.teacherPageHint")}</p>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={t("edu.teacherName")}>
          <Input value={form.display_name} onChange={(event) => setField("display_name", event.target.value)} />
        </Field>
        <Field label={t("edu.teacherHeadline")}>
          <Input value={form.headline} onChange={(event) => setField("headline", event.target.value)} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label={t("edu.teacherPhoto")}>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
        </Field>
        {preview ? <img src={preview} alt="" className="mt-2 size-20 rounded-full object-cover" /> : null}
      </div>
      <div className="mt-4">
        <Field label={t("edu.teacherBio")}>
          <Textarea value={form.bio} onChange={(event) => setField("bio", event.target.value)} rows={4} />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={t("edu.teacherWebsite")}>
          <Input value={form.website} onChange={(event) => setField("website", event.target.value)} dir="ltr" />
        </Field>
        <Field label={t("edu.teacherLinkedin")}>
          <Input value={form.linkedin_url} onChange={(event) => setField("linkedin_url", event.target.value)} dir="ltr" />
        </Field>
        <Field label={t("edu.teacherTelegram")}>
          <Input value={form.telegram_url} onChange={(event) => setField("telegram_url", event.target.value)} dir="ltr" />
        </Field>
        <Field label={t("edu.teacherInstagram")}>
          <Input value={form.instagram_url} onChange={(event) => setField("instagram_url", event.target.value)} dir="ltr" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label={t("edu.teacherProjects")} hint={t("edu.teacherProjectsHint")}>
          <Textarea value={form.projects_text} onChange={(event) => setField("projects_text", event.target.value)} rows={4} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save}>
          {t("common.save")}
        </Button>
        {saved ? <span className="text-xs text-green-700">{t("edu.saved")}</span> : null}
      </div>
    </section>
  );
}
