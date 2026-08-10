"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar, Badge, Button, Card, Spinner } from "@/components/ui";
import { apiList } from "@/lib/api";
import { displayName, useAuth } from "@/lib/auth";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiList<Project>("/projects/?roots_only=true")
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
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

  const totalProcesses = projects.reduce(
    (sum, project) => sum + (project.process_count ?? 0),
    0,
  );

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
          <div>
            <h1 className="text-xl font-bold">
              خوش آمدید، {displayName(profile)}
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              {profile?.job_title || "سرویس مورد نظر خود را از نوار بالا انتخاب کنید"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/explanation">
            <Button variant="secondary" size="sm">
              ورود به تشریح سیستم
            </Button>
          </Link>
          {profileIncomplete && (
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/15">
                تکمیل پروفایل
              </Button>
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">پروژه‌های اصلی</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? <Spinner className="size-5" /> : projects.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">فرایندهای مستندشده</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? <Spinner className="size-5" /> : totalProcesses}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">وضعیت پروفایل</p>
          <p className="mt-2">
            {profileIncomplete ? (
              <Badge tone="amber">ناقص</Badge>
            ) : (
              <Badge tone="green">تکمیل‌شده</Badge>
            )}
          </p>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            پروژه‌های اخیر
          </h2>
          <Link
            href="/explanation"
            className="text-sm text-link hover:text-link-hover hover:underline"
          >
            مشاهده همه
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
              هنوز پروژه‌ای نساخته‌اید. برای شروع به سرویس تشریح سیستم بروید.
            </p>
            <div className="mt-3">
              <Link href="/explanation">
                <Button size="sm">ساخت اولین پروژه</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.slice(0, 4).map((project) => (
              <Link key={project.id} href={`/explanation/projects/${project.id}`}>
                <Card className="transition hover:border-brand-500 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {project.company_name || "بدون نام شرکت"}
                      </p>
                    </div>
                    <Badge tone="blue">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span>{project.sub_project_count ?? 0} زیرپروژه</span>
                    <span>{project.process_count ?? 0} فرایند</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
