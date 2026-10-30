"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import FetchModule from "./settings/FetchModule";
import UpdateNewsModule from "./settings/UpdateNewsModule";
import WarehouseModule from "./settings/WarehouseModule";
import { useSignal } from "./SignalContext";

export default function SignalSettings() {
  const { access } = useSignal();
  const router = useRouter();

  useEffect(() => {
    if (!access?.is_fetch_admin) {
      router.replace("/news");
    }
  }, [access?.is_fetch_admin, router]);

  if (!access?.is_fetch_admin) return null;

  return (
    <div className="set-grid">
      <UpdateNewsModule />
      <FetchModule />
      <WarehouseModule />
    </div>
  );
}
