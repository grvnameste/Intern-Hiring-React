"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { RequireAuth, useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { Role, User } from "../../lib/types";

const emptyForm = {
  name: "",
  email: "",
  password: "Demo@123",
  role: "EMPLOYEE" as Role,
  department: "",
  managerId: "",
};

function AdminUsersContent() {
  const { notify } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const managers = users.filter((user) => user.role === "MANAGER");

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await apiFetch<User[]>("/api/users"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadUsers());
  }, []);

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name || !form.email || form.password.length < 6) {
      setError("Name, valid email, and a 6 character password are required");
      return;
    }

    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          department: form.department || null,
          managerId: form.managerId || null,
        }),
      });
      setForm(emptyForm);
      notify("success", "User created");
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create user";
      setError(message);
      notify("error", message);
    }
  };

  return (
    <DashboardShell title="User management" description="Create accounts and assign roles and reporting lines.">
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={submitUser} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Create user</h2>
          <div className="mt-4 grid gap-3">
            <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
            <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
            <input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="rounded-md border border-slate-300 px-3 py-2">
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <input placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
            <select value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2">
              <option value="">No manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>{manager.name}</option>
              ))}
            </select>
          </div>
          {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Create user
          </button>
        </form>

        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          {loading ? <p className="p-5 text-sm text-slate-600">Loading...</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Manager</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">{user.department ?? "-"}</td>
                    <td className="px-4 py-3">{user.manager?.name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

export default function AdminUsersPage() {
  return (
    <RequireAuth roles={["ADMIN"]}>
      <AdminUsersContent />
    </RequireAuth>
  );
}
