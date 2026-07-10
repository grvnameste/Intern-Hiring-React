"use client";

import Link from "next/link";
import { RequireAuth, useAuth } from "../context/AuthContext";
import { DashboardShell } from "../components/DashboardShell";

const roleCards = {
  EMPLOYEE: [
    { title: "Apply for leave", href: "/employee/apply", text: "Submit a new leave request for manager review." },
    { title: "History and balances", href: "/employee/history", text: "Review request status and remaining balances." },
  ],
  MANAGER: [
    { title: "Team requests", href: "/manager/requests", text: "Approve or reject pending direct team requests." },
    { title: "Team calendar", href: "/manager/requests", text: "Scan team leave dates in one place." },
  ],
  ADMIN: [
    { title: "Manage users", href: "/admin/users", text: "Create employee, manager, and admin accounts." },
    { title: "Manage leave types", href: "/admin/leave-types", text: "Set available leave policies and max days." },
    { title: "Reports", href: "/admin/reports", text: "View leave summary and balance reports." },
  ],
};

function DashboardContent() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <DashboardShell
      title={`${user.role.charAt(0)}${user.role.slice(1).toLowerCase()} dashboard`}
      description="Role-specific workflows and shortcuts."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roleCards[user.role].map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
          </Link>
        ))}
      </section>
    </DashboardShell>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
