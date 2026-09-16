"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CheckIcon,
  CompanyIcon,
  InboxIcon,
  MinutesDocIcon,
  MinutesIconTile,
  StatusIcon,
} from "@/components/minutes/MinutesIcons";
import { Alert, Avatar, Button, Modal, Spinner } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { displayName, useAuth } from "@/lib/auth";
import { CHARACTERS } from "@/lib/characters";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import type { MinutesInvitation } from "@/lib/minutes";
import { ThemeToggle } from "@/lib/theme";
import type { WorkInvitation } from "@/lib/work";

type HomeInvite = {
  key: string;
  kind: "work" | "minutes";
  id: number;
  title: string;
  from: string;
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t, n } = useI18n();
  const [workInvites, setWorkInvites] = useState<WorkInvitation[]>([]);
  const [minutesInvites, setMinutesInvites] = useState<MinutesInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workRows, minuteRows] = await Promise.all([
        apiList<WorkInvitation>("/work/invitations/").catch(() => [] as WorkInvitation[]),
        apiList<MinutesInvitation>("/minutes/invitations/?scope=inbox").catch(
          () => [] as MinutesInvitation[],
        ),
      ]);
      setWorkInvites(workRows.filter((row) => row.status === "pending"));
      setMinutesInvites(minuteRows.filter((row) => row.status === "pending"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadInboxFail"));
      setWorkInvites([]);
      setMinutesInvites([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const profileIncomplete =
    !profile?.first_name || !profile?.last_name || !profile?.company_name;

  useEffect(() => {
    if (!profile || !profileIncomplete) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("ta_profile_nudge") === "1") {
      return;
    }
    setProfileOpen(true);
  }, [profile, profileIncomplete]);

  const invites = useMemo<HomeInvite[]>(() => {
    const work = workInvites.map((row) => ({
      key: `work-${row.id}`,
      kind: "work" as const,
      id: row.id,
      title: row.team_name,
      from: row.invited_by_name,
    }));
    const minutes = minutesInvites.map((row) => ({
      key: `minutes-${row.id}`,
      kind: "minutes" as const,
      id: row.id,
      title: row.group_name,
      from: row.invited_by_name,
    }));
    return [...work, ...minutes];
  }, [workInvites, minutesInvites]);

  const respond = async (invite: HomeInvite, accept: boolean) => {
    setBusyKey(invite.key);
    setError(null);
    try {
      const path =
        invite.kind === "work"
          ? `/work/invitations/${invite.id}/${accept ? "accept" : "reject"}/`
          : `/minutes/invitations/${invite.id}/${accept ? "accept" : "reject"}/`;
      await apiFetch(path, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.inviteFail"));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-l from-navy-900 to-navy-700 px-5 py-4 text-white sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile?.profile_image}
            name={displayName(profile)}
            size={48}
            className="ring-2 ring-brand-500"
          />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">
                {t("dash.welcome", { name: displayName(profile) })}
              </h1>
              <p className="mt-0.5 truncate text-sm text-gray-300">
                {profile?.job_title || t("dash.pickService")}
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <LanguageSwitch />
            </div>
          </div>
        </div>
        {profileIncomplete ? (
          <div className="mt-3">
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/15">
                {t("dash.completeProfile")}
              </Button>
            </Link>
          </div>
        ) : null}
      </section>

      {error ? <Alert>{error}</Alert> : null}

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-brand-500/40 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-brand-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <MinutesIconTile tone="brand" size="sm">
                <InboxIcon className="size-4" />
              </MinutesIconTile>
              <h2 className="text-sm font-bold text-ink">{t("dash.invites")}</h2>
              {invites.length > 0 ? (
                <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-navy-900">
                  {n(invites.length)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[28rem] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Spinner />
              </div>
            ) : invites.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-gray-500">{t("dash.noInvites")}</p>
            ) : (
              invites.map((invite) => (
                <article
                  key={invite.key}
                  className="rounded-xl border border-brand-200 bg-brand-50/70 p-3"
                >
                  <p className="text-[11px] font-semibold text-brand-800">
                    {invite.kind === "work" ? t("dash.inviteWork") : t("dash.inviteMinutes")}
                  </p>
                  <p className="mt-0.5 font-bold text-ink">{invite.title}</p>
                  <p className="text-xs text-gray-600">{t("minutes.fromBy", { name: invite.from })}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="min-h-9"
                      loading={busyKey === invite.key}
                      onClick={() => respond(invite, true)}
                    >
                      <CheckIcon className="size-4" />
                      {t("minutes.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-9"
                      disabled={busyKey === invite.key}
                      onClick={() => respond(invite, false)}
                    >
                      {t("minutes.reject")}
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-gray-100 px-4 py-2.5 text-xs">
            <Link href="/work/inbox" className="font-medium text-navy-800 hover:text-link">
              {t("dash.seeWorkInbox")}
            </Link>
            <Link href="/minutes/inbox" className="font-medium text-navy-800 hover:text-link">
              {t("dash.seeMinutesInbox")}
            </Link>
          </div>
        </aside>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ProductTile
            href="/work"
            tone="brand"
            icon={<StatusIcon />}
            title={t("dash.enterWork")}
            blurb={t("dash.workBlurb")}
          />
          <ProductTile
            href="/minutes"
            tone="navy"
            icon={<MinutesDocIcon />}
            title={t("dash.enterMinutes")}
            blurb={t("dash.minutesBlurb")}
          />
          <ProductTile
            href="/explanation"
            tone="soft"
            icon={<CompanyIcon />}
            title={t("dash.enterExplanation")}
            blurb={t("dash.explanationBlurb")}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">{t("dash.galleryTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <GalleryCard
            src="/dashboard/team.png"
            title={t("dash.galleryTeam")}
            desc={t("dash.galleryTeamDesc")}
          />
          <GalleryCard
            src="/dashboard/minutes.png"
            title={t("dash.galleryMinutes")}
            desc={t("dash.galleryMinutesDesc")}
          />
          <GalleryCard
            src="/dashboard/docs.png"
            title={t("dash.galleryDocs")}
            desc={t("dash.galleryDocsDesc")}
          />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-ink">{t("dash.peopleTitle")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {CHARACTERS.map((card) => (
            <article
              key={card.id}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.src}
                alt=""
                className="aspect-square w-full object-cover object-top"
              />
              <div className="p-3">
                <h3 className="text-sm font-bold text-ink">{t(card.nameKey)}</h3>
                <p className="mt-1 text-[11px] font-medium leading-5 text-navy-800">
                  {card.adjKeys.map((key) => t(key)).join(" · ")}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-gray-500">{t(card.blurbKey)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Modal
        open={profileOpen}
        title={t("dash.profileTitle")}
        onClose={() => {
          sessionStorage.setItem("ta_profile_nudge", "1");
          setProfileOpen(false);
        }}
      >
        <p className="text-sm text-gray-600">{t("dash.profileHint")}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              sessionStorage.setItem("ta_profile_nudge", "1");
              setProfileOpen(false);
            }}
          >
            {t("common.later")}
          </Button>
          <Link href="/profile" onClick={() => sessionStorage.setItem("ta_profile_nudge", "1")}>
            <Button>{t("dash.completeProfile")}</Button>
          </Link>
        </div>
      </Modal>
    </div>
  );
}

function ProductTile({
  href,
  tone,
  icon,
  title,
  blurb,
}: {
  href: string;
  tone: "navy" | "brand" | "soft";
  icon: ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[9.5rem] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow-md"
    >
      <MinutesIconTile tone={tone}>{icon}</MinutesIconTile>
      <h3 className="mt-3 text-sm font-bold leading-6 text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">{blurb}</p>
    </Link>
  );
}

function GalleryCard({ src, title, desc }: { src: string; title: string; desc: string }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-40 w-full object-cover sm:h-48" />
      <div className="p-4">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">{desc}</p>
      </div>
    </article>
  );
}
