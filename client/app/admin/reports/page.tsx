"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { RequireAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { LeaveBalance, LeaveRequest } from "../../lib/types";

type Summary = {
  totalApprovedRequests: number;
  byLeaveType: { leaveType: string; requests: number; days: number }[];
  requests: LeaveRequest[];
};

function AdminReportsContent() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>("/api/reports/leave-summary"),
      apiFetch<LeaveBalance[]>("/api/reports/leave-balance"),
    ])
      .then(([summaryData, balanceData]) => {
        setSummary(summaryData);
        setBalances(balanceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load reports"));
  }, []);

  return (
    <DashboardShell title="Admin reports" description="View leave usage and remaining balances across the company.">
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Approved requests</p>
          <p className="mt-2 text-3xl font-semibold">{summary?.totalApprovedRequests ?? 0}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Balance rows</p>
          <p className="mt-2 text-3xl font-semibold">{balances.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Leave types used</p>
          <p className="mt-2 text-3xl font-semibold">{summary?.byLeaveType.length ?? 0}</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Leave summary</h2>
          <div className="mt-4 space-y-3">
            {summary?.byLeaveType.map((item) => (
              <div key={item.leaveType} className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                <span>{item.leaveType}</span>
                <strong>{item.days} days across {item.requests} requests</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold">Leave balance report</h2>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr key={balance.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{balance.user?.name}</td>
                    <td className="px-4 py-3">{balance.user?.department ?? "-"}</td>
                    <td className="px-4 py-3">{balance.leaveType.name}</td>
                    <td className="px-4 py-3">{balance.balance}</td>
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

export default function AdminReportsPage() {
  return (
    <RequireAuth roles={["ADMIN"]}>
      <AdminReportsContent />
    </RequireAuth>
  );
}
