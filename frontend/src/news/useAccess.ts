"use client";

import { useEffect, useState } from "react";

import { newsAccess } from "./api";
import type { NewsAccess } from "./types";

export function useNewsAccess() {
  const [row, setRow] = useState<NewsAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    newsAccess()
      .then((data) => {
        if (!cancelled) setRow(data);
      })
      .catch(() => {
        if (!cancelled) setRow({ allowed: false, is_fetch_admin: false, language: "en", group: "" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return row;
}
