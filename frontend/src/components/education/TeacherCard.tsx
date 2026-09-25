import Link from "next/link";

import { mediaUrl } from "@/lib/api";
import type { EduTeacherCard } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function TeacherCard({ teacher }: { teacher?: EduTeacherCard | null }) {
  const { t } = useI18n();
  if (!teacher) return null;
  const photo = mediaUrl(teacher.photo_url);
  const name = teacher.name || t("edu.teacher");

  return (
    <Link
      href={`/education/teachers/${teacher.id}`}
      className="block w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-brand-500 lg:w-[19.5rem]"
    >
      <p className="text-[11px] font-semibold text-brand-800">{t("edu.teacher")}</p>
      <div className="mt-3 flex items-start gap-3">
        {photo ? (
          <img src={photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-brand-400">
            {name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{name}</p>
          {teacher.headline ? <p className="mt-1 text-xs leading-5 text-gray-500">{teacher.headline}</p> : null}
        </div>
      </div>
    </Link>
  );
}
