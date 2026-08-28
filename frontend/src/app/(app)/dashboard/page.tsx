"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar, Badge, Button, Card, Modal, Spinner } from "@/components/ui";
import { apiFetch, apiList } from "@/lib/api";
import { displayName, useAuth } from "@/lib/auth";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { type Project } from "@/lib/types";
import type { WorkDashboard } from "@/lib/work";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [work, setWork] = useState<WorkDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiList<Project>("/projects/?roots_only=true"),
      apiList<Project>("/projects/?roots_only=true&shared=true"),
      apiFetch<WorkDashboard>("/work/dashboard/").catch(() => null),
    ])
      .then(([mine, shared, dashboard]) => {
        if (cancelled) return;
        // Owned / all accessible roots for "recent"; shared section uses shared-only.
        setProjects(mine.filter((p) => !p.is_shared_with_me));
        setSharedProjects(shared);
        setWork(dashboard);
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([]);
          setSharedProjects([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const profileIncomplete =
    !profile?.first_name || !profile?.last_name || !profile?.company_name;

  useEffect(() => {
    if (!profile || !profileIncomplete) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("ta_profile_nudge") === "1") {
      return;
    }
    setProfileOpen(true);
  }, [profile, profileIncomplete]);

  const totalProcesses =
    projects.reduce((sum, project) => sum + (project.process_count ?? 0), 0) +
    sharedProjects.reduce((sum, project) => sum + (project.process_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-l from-navy-900 to-navy-700 p-6 text-white">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile?.profile_image}
            name={displayName(profile)}
            size={56}
            className="ring-2 ring-brand-500"
          />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div>
            <h1 className="text-xl font-bold">
              {t("dash.welcome", { name: displayName(profile) })}
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              {profile?.job_title || t("dash.pickService")}
            </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitch />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/work">
            <Button variant="secondary" size="sm">
              {t("dash.enterWork")}
            </Button>
          </Link>
          <Link href="/explanation">
            <Button variant="secondary" size="sm">
              {t("dash.enterExplanation")}
            </Button>
          </Link>
          {profileIncomplete && (
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/15">
                {t("dash.completeProfile")}
              </Button>
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">{t("dash.myFolders")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? <Spinner className="size-5" /> : projects.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">{t("dash.sharedWithMe")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? <Spinner className="size-5" /> : sharedProjects.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">{t("dash.documentedProcesses")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? <Spinner className="size-5" /> : totalProcesses}
          </p>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t("dash.workManage")}</h2>
          <Link
            href="/work"
            className="text-sm text-link hover:text-link-hover hover:underline"
          >
            {t("dash.workHome")}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-gray-500">{t("dash.openTasks")}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {loading ? <Spinner className="size-5" /> : work?.employee.counts.assigned ?? 0}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">{t("dash.dueToday")}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {loading ? <Spinner className="size-5" /> : work?.employee.counts.today ?? 0}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">{t("dash.overdue")}</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {loading ? <Spinner className="size-5" /> : work?.employee.counts.overdue ?? 0}
            </p>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {t("dash.recentFolders")}
          </h2>
          <Link
            href="/explanation"
            className="text-sm text-link hover:text-link-hover hover:underline"
          >
            {t("dash.viewAll")}
          </Link>
        </div>

        {loading ? (
          <Card>
            <div className="flex justify-center py-6 text-gray-400">
              <Spinner />
            </div>
          </Card>
        ) : projects.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">
              {t("dash.noFolderYet")}
            </p>
            <div className="mt-3">
              <Link href="/explanation">
                <Button size="sm">{t("dash.createFirstFolder")}</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.slice(0, 4).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {t("dash.sharedWithMe")}
          </h2>
        </div>
        {loading ? (
          <Card>
            <div className="flex justify-center py-6 text-gray-400">
              <Spinner />
            </div>
          </Card>
        ) : sharedProjects.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">
              {t("dash.noShared")}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sharedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} shared />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={profileOpen}
        title={t("dash.profileTitle")}
        onClose={() => {
          sessionStorage.setItem("ta_profile_nudge", "1");
          setProfileOpen(false);
        }}
      >
        <p className="text-sm text-gray-600">
          {t("dash.profileHint")}
        </p>
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

function ProjectCard({
  project,
  shared = false,
}: {
  project: Project;
  shared?: boolean;
}) {
  const { t, n } = useI18n();
  return (
    <Link href={`/explanation/projects/${project.id}`}>
      <Card className="transition hover:border-brand-500 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900">{project.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {project.company_name || t("dash.noCompany")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone="blue">{t(`status.${project.status}`)}</Badge>
            {shared && project.my_role && (
              <Badge tone="amber">{t(`role.${project.my_role}`)}</Badge>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          {(project.sub_project_count ?? 0) > 0 && (
            <span>{t("dash.subfolders", { count: n(project.sub_project_count ?? 0) })}</span>
          )}
          <span>{t("dash.processes", { count: n(project.process_count ?? 0) })}</span>
        </div>
      </Card>
    </Link>
  );
}
