"use client";

import type { ReactNode } from "react";

import { cx } from "@/components/ui";

export default function WorkTable({
  columns,
  children,
  empty,
  compact,
  className,
}: {
  columns: string[];
  children: ReactNode;
  empty?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      <table className={cx("w-full text-right text-sm", !compact && "min-w-[560px]")}>
        <thead className="sticky top-0 z-10 bg-navy-900 text-white">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className={cx(
                  "whitespace-nowrap text-xs font-semibold",
                  compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
                )}
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
    <td className={cx("border-t border-gray-100 px-2.5 py-1.5 align-middle", className)}>
      {children}
    </td>
  );
}
