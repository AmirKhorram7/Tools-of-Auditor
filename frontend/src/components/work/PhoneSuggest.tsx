"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { WorkUserLookup } from "@/lib/work";

export default function PhoneSuggest({
  value,
  onChange,
}: {
  value: string;
  onChange: (phone: string) => void;
}) {
  const [hits, setHits] = useState<WorkUserLookup[]>([]);

  useEffect(() => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 4) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const rows = await apiFetch<WorkUserLookup[]>(
          `/users/lookup/?phone=${encodeURIComponent(digits)}`,
        );
        setHits(Array.isArray(rows) ? rows : []);
      } catch {
        setHits([]);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative">
      <Input
        dir="ltr"
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="09xxxxxxxxx"
      />
      {hits.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
          {hits.map((user) => {
            const name = `${user.first_name} ${user.last_name}`.trim();
            return (
              <li key={user.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-surface"
                  onClick={() => {
                    onChange(user.phone_number);
                    setHits([]);
                  }}
                >
                  <span className="text-ink">{name || "کاربر"}</span>
                  <span dir="ltr" className="text-xs text-gray-500">
                    {user.phone_number}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
