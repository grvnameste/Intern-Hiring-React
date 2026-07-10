"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { RequireAuth, useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { LeaveType, User } from "../../lib/types";

export function validateLeaveApplication(values: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  if (!values.leaveTypeId) return "Select a leave type";
  if (!values.startDate || !values.endDate) return "Select start and end dates";
  if (values.endDate < values.startDate) return "End date must be on or after start date";
  if (values.reason.trim().length < 5) return "Reason must be at least 5 characters";
  return "";
}

function ApplyLeaveContent() {
  const { notify, refreshUser } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<LeaveType[]>("/api/leave-types")
      .then((data) => {
        setLeaveTypes(data);
        setForm((current) => ({ ...current, leaveTypeId: data[0]?.id ?? "" }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load leave types"))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateLeaveApplication(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/leave-requests", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...current, startDate: "", endDate: "", reason: "" }));
      await refreshUser();
      notify("success", "Leave request submitted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit leave request";
      setError(message);
      notify("error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell title="Apply for leave" description="Submit a pending request for manager approval.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={onSubmit} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-800">Leave type</span>
              <select
                value={form.leaveTypeId}
                onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                disabled={loading}
              >
                {leaveTypes.map((leaveType) => (
                  <option key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium text-slate-800">Start date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="text-sm font-medium text-slate-800">End date</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-800">Reason</span>
              <textarea
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || loading}
            className="mt-5 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-400"
          >
            {submitting ? "Submitting..." : "Submit request"}
          </button>
        </form>
        <BalancePanel />
      </div>
    </DashboardShell>
  );
}

function BalancePanel() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    apiFetch<User>("/api/users/me").then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <aside className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold text-slate-950">Available balances</h2>
      <div className="mt-4 space-y-3">
        {user?.leaveBalances?.map((balance) => (
          <div key={balance.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
            <span className="text-slate-700">{balance.leaveType.name}</span>
            <span className="font-semibold text-slate-950">{balance.balance} days</span>
          </div>
        )) ?? <p className="text-sm text-slate-500">Loading balances...</p>}
      </div>
    </aside>
  );
}

export default function ApplyLeavePage() {
  return (
    <RequireAuth roles={["EMPLOYEE"]}>
      <ApplyLeaveContent />
    </RequireAuth>
  );
}
