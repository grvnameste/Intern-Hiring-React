import type { LoginResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const TOKEN_KEY = "leave-management-token";

export const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string) => {
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = () => {
  window.localStorage.removeItem(TOKEN_KEY);
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token = getStoredToken(),
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }

  return data as T;
}

export const login = (email: string, password: string) =>
  apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, null);
