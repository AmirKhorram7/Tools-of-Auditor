"use client";

import type { ReactNode } from "react";

import { cx } from "@/components/ui";

export default function WorkTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-right text-sm">
        <thead className="bg-navy-900 text-white">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function WorkTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cx("border-t border-gray-100 px-3 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
