"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MinutesInvitation } from "@/lib/minutes";

export default function MinutesInboxPage() {
  const { t } = useI18n();
  const [invites, setInvites] = useState<MinutesInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiList<MinutesInvitation>("/minutes/invitations/?scope=inbox");
      setInvites(rows.filter((row) => row.status === "pending"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.loadHomeFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: number, accept: boolean) => {
    setBusyId(id);
    try {
      await apiFetch(`/minutes/invitations/${id}/${accept ? "accept" : "reject"}/`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("minutes.inviteFail"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <WorkBreadcrumb
        fallbackHref="/minutes"
        items={[
          { href: "/minutes", label: t("minutes.crumb") },
          { label: t("minutes.inboxTitle") },
        ]}
      />
      {error && <Alert>{error}</Alert>}
      {invites.length === 0 ? (
        <EmptyState title={t("minutes.noInvites")} />
      ) : (
        <div className="grid gap-2">
          {invites.map((invite) => (
            <Card key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{invite.group_name}</p>
                <p className="text-xs text-gray-500">
                  {t("minutes.fromBy", { name: invite.invited_by_name })}
                </p>
                <div className="mt-1">
                  <Badge>{t(`minutes.role.${invite.role}`)}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={busyId === invite.id}
                  onClick={() => respond(invite.id, true)}
                >
                  {t("minutes.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => respond(invite.id, false)}
                >
                  {t("minutes.reject")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Link href="/minutes" className="text-sm text-link hover:underline">
        ← {t("minutes.title")}
      </Link>
    </div>
  );
}
