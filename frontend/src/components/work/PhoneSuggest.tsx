"use client";

import { useEffect, useMemo, useState } from "react";

import { Avatar, Input } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { WorkUserLookup } from "@/lib/work";

function displayName(user: WorkUserLookup) {
  return `${user.first_name} ${user.last_name}`.trim() || "کاربر";
}

export default function PhoneSuggest({
  value,
  onChange,
}: {
  value: string;
  onChange: (phone: string) => void;
}) {
  const [hits, setHits] = useState<WorkUserLookup[]>([]);
  const [picked, setPicked] = useState<WorkUserLookup | null>(null);

  useEffect(() => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 4) {
      setHits([]);
      setPicked(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const rows = await apiFetch<WorkUserLookup[]>(
          `/users/lookup/?phone=${encodeURIComponent(digits)}`,
        );
        const list = Array.isArray(rows) ? rows : [];
        setHits(list);
        const exact = list.find((user) => user.phone_number.replace(/\D/g, "") === digits);
        setPicked(exact || null);
      } catch {
        setHits([]);
        setPicked(null);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value]);

  const openHits = useMemo(
    () => hits.filter((user) => user.phone_number !== value),
    [hits, value],
  );

  return (
    <div className="relative space-y-2">
      <Input
        dir="ltr"
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="09xxxxxxxxx"
        autoComplete="off"
      />
      {openHits.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
          {openHits.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-surface"
                onClick={() => {
                  onChange(user.phone_number);
                  setPicked(user);
                  setHits([]);
                }}
              >
                <Avatar src={user.profile_image} name={displayName(user)} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {displayName(user)}
                  </span>
                  <span dir="ltr" className="block text-xs text-gray-500">
                    {user.phone_number}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-2.5 py-2">
          <Avatar src={picked.profile_image} name={displayName(picked)} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{displayName(picked)}</p>
            <p dir="ltr" className="text-xs text-gray-500">
              {picked.phone_number}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
