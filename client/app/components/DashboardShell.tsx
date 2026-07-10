"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import type { Role, User } from "../lib/types";

type NavItem = {
  href: string;
  label: string;
  roles: Role[];
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { href: "/employee/apply", label: "Apply Leave", roles: ["EMPLOYEE"] },
  { href: "/employee/history", label: "History & Balances", roles: ["EMPLOYEE"] },
  { href: "/manager/requests", label: "Team Requests", roles: ["MANAGER"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "/admin/leave-types", label: "Leave Types", roles: ["ADMIN"] },
  { href: "/admin/reports", label: "Reports", roles: ["ADMIN"] },
];

export function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <nav className="flex flex-wrap gap-2">
      {visibleItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-emerald-700 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { user, logoutUser, toast } = useAuth();

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Employee Leave Management
              </p>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                {title}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="text-slate-500">{user.role}</p>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Sign out
              </button>
            </div>
          </div>
          <DashboardNav user={user} />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.kind === "success" ? "bg-emerald-700" : "bg-red-700"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
