"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar, cx } from "@/components/ui";
import { TrashIcon } from "@/components/minutes/MinutesIcons";
import { MinutesLogo } from "@/components/minutes/MinutesLogo";
import { formatJalaliDisplay } from "@/components/work/JalaliDateField";
import { useI18n } from "@/lib/i18n";
import { meetingStatusClass, type MinutesMeeting } from "@/lib/minutes";

export default function MinutesMeetingsTable({
  meetings,
  showGroup = true,
  empty,
  onDelete,
}: {
  meetings: MinutesMeeting[];
  showGroup?: boolean;
  empty?: ReactNode;
  onDelete?: (meeting: MinutesMeeting) => void;
}) {
  const router = useRouter();
  const { t, n, locale } = useI18n();
  const latin = locale === "en";
  const showActions = Boolean(onDelete && meetings.some((row) => row.can_delete));

  if (meetings.length === 0) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-navy-800/10 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-navy-900 text-white">
          <tr>
            <Th>{t("minutes.number")}</Th>
            <Th>{t("minutes.colTitle")}</Th>
            <Th>{t("minutes.meetingDate")}</Th>
            <Th>{t("minutes.clerk")}</Th>
            {showGroup ? <Th>{t("minutes.group")}</Th> : null}
            <Th>{t("minutes.colItems")}</Th>
            <Th>{t("minutes.status")}</Th>
            {showActions ? <Th>{t("minutes.actions")}</Th> : null}
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting, index) => {
            const open = meeting.status === "open";
            return (
              <tr
                key={meeting.id}
                onClick={() => router.push(`/minutes/meetings/${meeting.id}`)}
                className={cx(
                  "cursor-pointer border-s-4 transition",
                  open ? "border-s-brand-500" : "border-s-navy-800",
                  open
                    ? "bg-brand-50/80 hover:bg-brand-100"
                      : index % 2 === 0
                      ? "bg-white hover:bg-surface"
                      : "bg-gray-50 hover:bg-surface",
                )}
              >
                <Td>
                  <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-navy-900 px-2 py-1 text-xs font-bold text-brand-500">
                    {n(meeting.meeting_number)}
                  </span>
                </Td>
                <Td>
                  <Link
                    href={`/minutes/meetings/${meeting.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="block max-w-[18rem] truncate font-bold text-navy-900 hover:text-link"
                  >
                    {meeting.name}
                  </Link>
                  {showGroup ? (
                    <p className="mt-0.5 truncate text-[11px] text-gray-500">{meeting.company_name}</p>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap font-medium text-ink">
                  {formatJalaliDisplay(meeting.date, latin)}
                </Td>
                <Td>
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar src={meeting.clerk_image} name={meeting.clerk_name} size={28} />
                    <span className="max-w-[9rem] truncate font-medium text-ink">
                      {meeting.clerk_name}
                    </span>
                  </span>
                </Td>
                {showGroup ? (
                  <Td>
                    <span className="flex min-w-0 items-center gap-2">
                      <MinutesLogo src={meeting.group_logo} name={meeting.group_name} size={32} kind="group" id={meeting.group} />
                      <span className="max-w-[9rem] truncate font-medium text-ink">
                        {meeting.group_name}
                      </span>
                    </span>
                  </Td>
                ) : null}
                <Td>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-white">
                      {t("minutes.itemsCount", { count: n(meeting.item_count) })}
                    </span>
                    {meeting.open_item_count > 0 ? (
                      <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-ink">
                        {t("minutes.openItems", { count: n(meeting.open_item_count) })}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <span
                    className={cx(
                      "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      meetingStatusClass(meeting.status),
                    )}
                  >
                    {t(`minutes.${meeting.status}`)}
                  </span>
                </Td>
                {showActions ? (
                  <Td>
                    {meeting.can_delete && onDelete ? (
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-red-50 hover:text-red-600"
                        aria-label={t("minutes.deleteMeeting")}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(meeting);
                        }}
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    ) : null}
                  </Td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-3 text-start text-xs font-semibold">{children}</th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx("px-3 py-3 align-middle", className)}>{children}</td>;
}
