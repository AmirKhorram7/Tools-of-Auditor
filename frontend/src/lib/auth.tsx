"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch, tokens } from "./api";
import type { Profile } from "./types";

type AuthState = {
  ready: boolean;
  isAuthenticated: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  signIn: (access: string, refresh: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);

  const loadProfile = useCallback(async () => {
    const data = await apiFetch<Profile>("/profile/");
    setProfileState(data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!tokens.access) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        await loadProfile();
        if (!cancelled) setIsAuthenticated(true);
      } catch {
        tokens.clear();
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (access: string, refresh: string) => {
      tokens.save(access, refresh);
      setIsAuthenticated(true);
      try {
        await loadProfile();
      } catch {
        // Profile can be fetched again later; login itself succeeded.
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    const refresh = tokens.refresh;
    if (refresh) {
      try {
        await apiFetch("/auth/logout/", { method: "POST", body: { refresh } });
      } catch {
        // Ignore: local sign-out must succeed regardless.
      }
    }
    tokens.clear();
    setIsAuthenticated(false);
    setProfileState(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      isAuthenticated,
      profile,
      refreshProfile: loadProfile,
      setProfile: setProfileState,
      signIn,
      signOut,
    }),
    [ready, isAuthenticated, profile, loadProfile, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function displayName(profile: Profile | null): string {
  if (!profile) return "کاربر";
  const full = `${profile.first_name} ${profile.last_name}`.trim();
  return full || profile.phone_number;
}
