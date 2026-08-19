"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import SocialFooter from "@/components/SocialFooter";
import { Alert, Button, Card, Field, Input, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LanguageSwitch, useI18n } from "@/lib/i18n";

type AuthResponse = {
  access: string;
  refresh: string;
  phone_number: string;
  is_new_user: boolean;
  has_password?: boolean;
};

const RESEND_SECONDS = 120;

type Mode = "otp" | "password";

export default function LoginPage() {
  const router = useRouter();
  const { ready, isAuthenticated, signIn } = useAuth();
  const { t } = useI18n();

  const [mode, setMode] = useState<Mode>("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (ready && isAuthenticated) router.replace("/dashboard");
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep("phone");
    setCode("");
    setPassword("");
    setError(null);
    setInfo(null);
    setCountdown(0);
  };

  const afterLogin = async (data: AuthResponse) => {
    await signIn(data.access, data.refresh);
    // New users, or returning users without a password yet, go to profile
    // so they can finish info + set a password.
    if (data.is_new_user || data.has_password === false) {
      router.replace("/profile");
      return;
    }
    router.replace("/dashboard");
  };

  const sendOtp = async () => {
    setError(null);
    setInfo(null);

    if (!/^09\d{9}$/.test(phone)) {
      setError(t("login.phoneInvalid"));
      return;
    }

    setLoading(true);
    try {
      await apiFetch<{ message: string }>("/auth/send-otp/", {
        method: "POST",
        body: { phone_number: phone },
        auth: false,
      });
      setStep("code");
      setCountdown(RESEND_SECONDS);
      setCode("");
      setInfo(t("login.otpSent"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.sendFail"));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setInfo(null);

    if (!/^\d{6}$/.test(code)) {
      setError(t("login.codeInvalid"));
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/verify-otp/", {
        method: "POST",
        body: { phone_number: phone, code },
        auth: false,
      });
      await afterLogin(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.codeWrong"));
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async () => {
    setError(null);
    setInfo(null);

    if (!/^09\d{9}$/.test(phone)) {
      setError(t("login.phoneInvalid"));
      return;
    }
    if (!password) {
      setError(t("login.passwordRequired"));
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/login/", {
        method: "POST",
        body: { phone_number: phone, password },
        auth: false,
      });
      await afterLogin(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("login.badCredentials"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-900 to-navy-800 p-4">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-center">
          <LanguageSwitch />
        </div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-ink">
            T
          </div>
          <h1 className="text-xl font-bold text-white">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-gray-300">{t("login.subtitle")}</p>
        </div>

        <Card>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={cx(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "otp"
                  ? "bg-white text-ink shadow-sm"
                  : "text-gray-600 hover:text-ink",
              )}
            >
              {t("login.otp")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={cx(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "password"
                  ? "bg-white text-ink shadow-sm"
                  : "text-gray-600 hover:text-ink",
              )}
            >
              {t("login.password")}
            </button>
          </div>

          {mode === "password" ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                loginWithPassword();
              }}
            >
              <Field label={t("login.phone")} hint={t("login.phoneHint")}>
                <Input
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  placeholder="09121234567"
                  inputMode="numeric"
                  dir="ltr"
                  className="text-center tracking-widest"
                  autoFocus
                />
              </Field>

              <Field label={t("login.passwordLabel")}>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  dir="ltr"
                  autoComplete="current-password"
                />
              </Field>

              {error && <Alert>{error}</Alert>}

              <Button type="submit" loading={loading} className="w-full">
                {t("login.submit")}
              </Button>

              <p className="text-center text-xs text-gray-500">
                {t("login.noPassword")}
              </p>
            </form>
          ) : step === "phone" ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                sendOtp();
              }}
            >
              <Field label={t("login.phone")} hint={t("login.phoneHint")}>
                <Input
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  placeholder="09121234567"
                  inputMode="numeric"
                  dir="ltr"
                  className="text-center tracking-widest"
                  autoFocus
                />
              </Field>

              {error && <Alert>{error}</Alert>}

              <Button type="submit" loading={loading} className="w-full">
                {t("login.getCode")}
              </Button>

              <p className="text-center text-xs text-gray-500">
                {t("login.accept")}
              </p>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                verifyOtp();
              }}
            >
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {t("login.codeSent", { phone })}
                <button
                  type="button"
                  className="ms-2 text-link hover:text-link-hover hover:underline"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  {t("login.changePhone")}
                </button>
              </div>

              <Field label={t("login.code")}>
                <Input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="------"
                  inputMode="numeric"
                  dir="ltr"
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </Field>

              {info && <Alert tone="success">{info}</Alert>}
              {error && <Alert>{error}</Alert>}

              <Button type="submit" loading={loading} className="w-full">
                {t("login.submit")}
              </Button>

              <div className="text-center text-sm">
                {countdown > 0 ? (
                  <span className="text-gray-500">
                    {t("login.resendIn", { seconds: countdown })}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-link hover:text-link-hover hover:underline"
                    onClick={sendOtp}
                  >
                    {t("login.resend")}
                  </button>
                )}
              </div>
            </form>
          )}
        </Card>

        <SocialFooter className="mt-6" />
      </div>
    </main>
  );
}
