"use client";

import { currentWeek, type WorkTaskRow } from "@/lib/work";

export default function WeekStrip({
  tasks,
}: {
  tasks: Array<Pick<WorkTaskRow, "due_date" | "status">>;
}) {
  const days = currentWeek();
  const open = tasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((day) => {
        const count = open.filter((task) => task.due_date?.slice(0, 10) === day.iso).length;
        const working = count > 0;
        return (
          <div
            key={day.iso}
            className={`rounded-xl border px-1 py-2 text-center sm:px-2 ${
              day.isToday
                ? "border-brand-500 bg-brand-50"
                : working
                  ? "border-navy-200 bg-white"
                  : "border-gray-100 bg-surface/70"
            }`}
          >
            <p className="text-[10px] text-gray-500 sm:text-xs">{day.weekday}</p>
            <p
              className={`mt-1 text-[11px] font-bold sm:text-sm ${
                working ? "text-navy-900" : "text-gray-400"
              }`}
            >
              {working ? `${count} کار` : day.isWeekend ? "تعطیل" : "استراحت"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
