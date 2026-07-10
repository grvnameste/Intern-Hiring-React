"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { RequireAuth, useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { LeaveType } from "../../lib/types";

function AdminLeaveTypesContent() {
  const { notify } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState(10);
  const [error, setError] = useState("");

  const loadLeaveTypes = async () => {
    try {
      setLeaveTypes(await apiFetch<LeaveType[]>("/api/leave-types"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave types");
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadLeaveTypes());
  }, []);

  const submitLeaveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2 || maxDays < 1) {
      setError("Name and positive max days are required");
      return;
    }

    try {
      await apiFetch("/api/leave-types", {
        method: "POST",
        body: JSON.stringify({ name, maxDays }),
      });
      setName("");
      setMaxDays(10);
      notify("success", "Leave type created");
      await loadLeaveTypes();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create leave type";
      setError(message);
      notify("error", message);
    }
  };

  return (
    <DashboardShell title="Leave type management" description="Create leave policies and set maximum days.">
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={submitLeaveType} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Create leave type</h2>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-medium">Max days</span>
            <input type="number" min={1} value={maxDays} onChange={(event) => setMaxDays(Number(event.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Create type
          </button>
        </form>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leaveTypes.map((leaveType) => (
            <article key={leaveType.id} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="font-semibold text-slate-950">{leaveType.name}</h2>
              <p className="mt-2 text-sm text-slate-600">Maximum {leaveType.maxDays} days</p>
            </article>
          ))}
        </section>
      </div>
    </DashboardShell>
  );
}

export default function AdminLeaveTypesPage() {
  return (
    <RequireAuth roles={["ADMIN"]}>
      <AdminLeaveTypesContent />
    </RequireAuth>
  );
}
