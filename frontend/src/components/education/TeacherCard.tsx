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
      className="block w-full rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-500"
    >
      <p className="text-xs text-gray-500">{t("edu.teacher")}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{name}</p>
          {teacher.headline ? <p className="mt-1 text-[13px] leading-5 text-gray-500">{teacher.headline}</p> : null}
        </div>
        {photo ? (
          <img src={photo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-navy-800">
            {name.slice(0, 1)}
          </span>
        )}
      </div>
    </Link>
  );
}
