"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert, Avatar, Badge, Button, Card, EmptyState, Field, Input, Textarea, cx } from "@/components/ui";
import JalaliDateField from "@/components/work/JalaliDateField";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CHARACTERS,
  ageBandFromBirthDate,
  ageFromBirthDate,
  characterById,
  characterFitsBand,
  characterForName,
  guessGender,
  hasPersonName,
  profileCharacterSrc,
} from "@/lib/characters";
import { useI18n } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import {
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
  const { t, n } = useI18n();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageKey, setImageKey] = useState(0);
  const [characterId, setCharacterId] = useState("");
  const [showCharacters, setShowCharacters] = useState(false);
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
      refreshProfile().catch(() => setError(t("profile.loadFail")));
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
    const loadedId = profile.character_id ?? "";
    const fullName = `${profile.first_name} ${profile.last_name}`.trim();
    const canSuggest = hasPersonName(fullName) && Boolean(guessGender(fullName));
    const band = ageBandFromBirthDate(profile.birth_date);
    const current = characterById(loadedId);
    if (
      canSuggest &&
      profile.birth_date &&
      !profile.profile_image &&
      (!current || !characterFitsBand(current, band))
    ) {
      const next = characterForName(fullName, profile.birth_date);
      if (next) {
        setCharacterId(next.id);
        void apiFetch<Profile>("/profile/", {
          method: "PATCH",
          body: { character_id: next.id },
        })
          .then(setProfile)
          .catch(() => undefined);
      } else {
        setCharacterId(loadedId);
      }
    } else {
      setCharacterId(loadedId);
    }
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
  const pickedCharacter = !imageFile ? characterById(characterId) : null;
  const age = ageFromBirthDate(form.birth_date);
  const named = hasPersonName(`${form.first_name} ${form.last_name}`);
  const mixedFaces = useMemo(() => {
    const zip = (first: typeof CHARACTERS, second: typeof CHARACTERS) => {
      const rows = [];
      const count = Math.max(first.length, second.length);
      for (let index = 0; index < count; index += 1) {
        if (first[index]) rows.push(first[index]);
        if (second[index]) rows.push(second[index]);
      }
      return rows;
    };
    const women = zip(
      CHARACTERS.filter((row) => row.gender === "woman" && row.ageBand === "adult"),
      CHARACTERS.filter((row) => row.gender === "woman" && row.ageBand === "mature"),
    );
    const men = zip(
      CHARACTERS.filter((row) => row.gender === "man" && row.ageBand === "adult"),
      CHARACTERS.filter((row) => row.gender === "man" && row.ageBand === "mature"),
    );
    return [...women, ...men];
  }, []);

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
        payload.append("character_id", "");
        updated = await apiFetch<Profile>("/profile/", {
          method: "PATCH",
          formData: payload,
        });
      } else {
        const body: Record<string, string | null> = { ...form, character_id: characterId };
        if (!body.birth_date) body.birth_date = null;
        updated = await apiFetch<Profile>("/profile/", {
          method: "PATCH",
          body,
        });
      }

      setProfile(updated);
      setImageFile(null);
      await refreshProfile().catch(() => undefined);
      setSuccess(t("profile.saveOk"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (password.length < 8) {
      setPasswordError(t("profile.passwordMin"));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
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
        setPasswordError(t("profile.currentRequired"));
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
        needsCurrent ? t("profile.passwordChanged") : t("profile.passwordSet"),
      );
      await refreshProfile().catch(() => undefined);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : t("profile.passwordFail"),
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
      setSideError(err instanceof ApiError ? err.message : t("profile.inviteFail"));
    } finally {
      setBusyId(null);
    }
  };

  const pendingInvites = invites.filter((row) => row.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("profile.subtitle")}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <TabBtn active={tab === "info"} label={t("profile.tabInfo")} onClick={() => setTab("info")} />
        <TabBtn
          active={tab === "invites"}
          label={
            pendingInvites.length > 0
              ? `${t("profile.tabInvites")} (${pendingInvites.length})`
              : t("profile.tabInvites")
          }
          onClick={() => setTab("invites")}
        />
        <TabBtn
          active={tab === "activity"}
          label={t("profile.tabActivity")}
          onClick={() => setTab("activity")}
        />
      </div>

      {tab === "invites" && (
        <section className="space-y-3">
          {sideError && <Alert>{sideError}</Alert>}
          {pendingInvites.length === 0 ? (
            <EmptyState
              title={t("profile.noInvitesTitle")}
              description={t("profile.noInvitesDesc")}
            />
          ) : (
            pendingInvites.map((invite) => (
              <Card key={invite.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{invite.team_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t("profile.from", { name: invite.invited_by_name })}
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
                      {t("profile.reject")}
                    </Button>
                    <Button
                      size="sm"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, true)}
                    >
                      {t("profile.accept")}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
          {invites.some((row) => row.status !== "pending") && (
            <p className="text-xs text-gray-400">
              {t("profile.previous")}{" "}
              {invites
                .filter((row) => row.status !== "pending")
                .slice(0, 6)
                .map(
                  (row) =>
                    `${row.team_name} (${t(`invite.${row.status}`)})`,
                )
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      {tab === "activity" && (
        <section>
          {activity.length === 0 ? (
            <EmptyState title={t("profile.noActivityTitle")} description={t("profile.noActivityDesc")} />
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
            src={
              previewUrl ??
              (pickedCharacter
                ? profileCharacterSrc(pickedCharacter)
                : profile?.profile_image)
            }
            name={`${form.first_name} ${form.last_name}`.trim() || t("common.user")}
            size={64}
          />
          <div>
            <p className="text-sm font-medium text-ink">{t("profile.photo")}</p>
            <p className="mb-2 text-xs text-gray-500">
              {t("profile.photoHint")}
            </p>
            <input
              key={imageKey}
              type="file"
              accept="image/*"
              onChange={(event) => {
                setImageFile(event.target.files?.[0] ?? null);
                setCharacterId("");
              }}
              className="text-xs text-gray-600"
            />
          </div>
          <div className="ms-auto space-y-1 text-end">
            <p className="text-xs text-gray-500">{t("profile.phoneLogin")}</p>
            <p dir="ltr" className="text-sm font-medium text-ink">
              {profile?.phone_number ?? "—"}
            </p>
            {hasPassword ? (
              <Badge tone="green">{t("profile.passwordOn")}</Badge>
            ) : (
              <Badge tone="amber">{t("profile.passwordOff")}</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setShowCharacters((open) => !open)}
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-l from-brand-500 via-amber-300 to-orange-400 px-4 py-3.5 text-start shadow-md ring-2 ring-brand-300 transition hover:brightness-110"
        >
          <span className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="ta-shine-bar absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/70 to-transparent" />
          </span>
          <span className="ta-spark relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-900 text-brand-400 shadow-inner ring-2 ring-white/70">
            {pickedCharacter ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileCharacterSrc(pickedCharacter)}
                alt=""
                className="size-full object-cover object-top"
              />
            ) : (
              <SparkleIcon className="size-6" />
            )}
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-base font-extrabold text-navy-900">
              {t("profile.character")}
            </span>
            <span className="mt-0.5 block text-xs font-bold text-navy-800">
              {showCharacters ? t("profile.characterHide") : t("profile.characterShow")}
            </span>
          </span>
          <span className="relative text-lg font-black text-navy-900">
            {showCharacters ? "▴" : "▾"}
          </span>
        </button>
        {showCharacters ? (
          <>
            <p className="mt-3 text-xs text-gray-500">
              {named ? t("profile.characterHint") : t("profile.needNameForFace")}
            </p>
            <CharacterGrid
              cards={mixedFaces}
              characterId={characterId}
              imageFile={imageFile}
              onPick={(id) => {
                setCharacterId(id);
                setImageFile(null);
                setImageKey((value) => value + 1);
              }}
            />
          </>
        ) : null}
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
            <Field label={t("profile.firstName")}>
              <Input
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
                placeholder={t("profile.firstName")}
              />
            </Field>
            <Field label={t("profile.lastName")}>
              <Input
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
                placeholder={t("profile.lastName")}
              />
            </Field>
            <Field label={t("profile.company")}>
              <Input
                value={form.company_name}
                onChange={(event) => update("company_name", event.target.value)}
                placeholder={t("profile.companyPlaceholder")}
              />
            </Field>
            <Field label={t("profile.job")}>
              <Input
                value={form.job_title}
                onChange={(event) => update("job_title", event.target.value)}
                placeholder={t("profile.jobPlaceholder")}
              />
            </Field>
            <Field label={t("profile.birth")}>
              <JalaliDateField
                kind="birth"
                value={form.birth_date}
                onChange={(iso) => {
                  update("birth_date", iso);
                  const nextBand = ageBandFromBirthDate(iso);
                  const current = characterById(characterId);
                  if (imageFile) return;
                  if (current && characterFitsBand(current, nextBand)) return;
                  const fullName = `${form.first_name} ${form.last_name}`.trim();
                  if (!hasPersonName(fullName) || !guessGender(fullName)) return;
                  const next = characterForName(fullName, iso);
                  if (next) setCharacterId(next.id);
                }}
              />
              {age != null ? (
                <p className="mt-1 text-xs text-gray-500">
                  {t("profile.ageHint", { age: n(age) })}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">{t("profile.birthHint")}</p>
              )}
            </Field>
          </div>

          <Field label={t("profile.bio")}>
            <Textarea
              rows={4}
              value={form.bio}
              onChange={(event) => update("bio", event.target.value)}
              placeholder={t("profile.bioPlaceholder")}
            />
          </Field>

          {error && <Alert>{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              {t("profile.saveChanges")}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink">
            {hasPassword ? t("profile.changePassword") : t("profile.setPassword")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {hasPassword
              ? t("profile.changePasswordHint")
              : t("profile.setPasswordHint")}
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
            <Field label={t("profile.currentPassword")}>
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
            <Field label={t("profile.newPassword")} hint={t("profile.passwordHint")}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                dir="ltr"
                autoComplete="new-password"
              />
            </Field>
            <Field label={t("profile.confirmPassword")}>
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
              {hasPassword ? t("profile.changePassword") : t("profile.savePassword")}
            </Button>
          </div>
        </form>
      </Card>
        </>
      )}
    </div>
  );
}

function CharacterGrid({
  cards,
  characterId,
  imageFile,
  onPick,
}: {
  cards: typeof CHARACTERS;
  characterId: string;
  imageFile: File | null;
  onPick: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
      {cards.map((card) => {
        const selected = characterId === card.id && !imageFile;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onPick(card.id)}
            className={cx(
              "overflow-hidden rounded-xl border bg-white transition",
              selected ? "border-brand-500 ring-2 ring-brand-200" : "border-gray-200 hover:border-brand-500",
            )}
            title={t(card.nameKey)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profileCharacterSrc(card)}
              alt=""
              className="aspect-square w-full object-cover object-top"
            />
            <span className="block truncate px-1 py-1 text-[11px] font-medium text-ink">
              {t(card.nameKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.2l1.55 5.9 5.9 1.55-5.9 1.55L12 17.1l-1.55-5.9-5.9-1.55 5.9-1.55L12 2.2z" />
      <path d="M18.2 13.4l.72 2.2 2.2.72-2.2.72-.72 2.2-.72-2.2-2.2-.72 2.2-.72.72-2.2z" />
    </svg>
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
