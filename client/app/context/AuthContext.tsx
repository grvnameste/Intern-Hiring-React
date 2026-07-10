"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearStoredToken, getStoredToken, login, setStoredToken } from "../lib/api";
import type { Role, User } from "../lib/types";

type Toast = { kind: "success" | "error"; message: string } | null;

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  toast: Toast;
  notify: (kind: "success" | "error", message: string) => void;
  loginUser: (email: string, password: string) => Promise<void>;
  logoutUser: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const router = useRouter();

  const notify = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await apiFetch<User>("/api/users/me", {}, storedToken);
      setUser(currentUser);
      setToken(storedToken);
    } catch {
      clearStoredToken();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshUser());
  }, [refreshUser]);

  const loginUser = useCallback(async (email: string, password: string) => {
    const result = await login(email, password);
    setStoredToken(result.token);
    setToken(result.token);
    setUser(result.user);
    notify("success", "Signed in successfully");
    router.push("/dashboard");
  }, [notify, router]);

  const logoutUser = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setToken(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, token, loading, toast, notify, loginUser, logoutUser, refreshUser }),
    [loading, loginUser, logoutUser, notify, refreshUser, toast, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, roles, router, user]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-600">Loading...</div>;
  }

  if (!user || (roles && !roles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
}
