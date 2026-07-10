"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { RequireAuth, useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { LeaveBalance, LeaveRequest } from "../../lib/types";

function EmployeeHistoryContent() {
  const { notify } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [leaveRequests, user] = await Promise.all([
        apiFetch<LeaveRequest[]>("/api/leave-requests"),
        apiFetch<{ leaveBalances: LeaveBalance[] }>("/api/users/me"),
      ]);
      setRequests(leaveRequests);
      setBalances(user.leaveBalances ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, []);

  const cancelRequest = async (id: string) => {
    try {
      await apiFetch(`/api/leave-requests/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      notify("success", "Leave request cancelled");
      await loadData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Unable to cancel request");
    }
  };

  return (
    <DashboardShell title="History and balances" description="Track your requests and remaining leave days.">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-950">Leave balances</h2>
          <div className="mt-4 space-y-3">
            {balances.map((balance) => (
              <div key={balance.id} className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                <span>{balance.leaveType.name}</span>
                <strong>{balance.balance} days</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Leave history</h2>
          </div>
          {loading ? <p className="p-5 text-sm text-slate-600">Loading...</p> : null}
          {error ? <p className="p-5 text-sm text-red-700">{error}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{request.leaveType?.name}</td>
                    <td className="px-4 py-3">
                      {request.startDate.slice(0, 10)} to {request.endDate.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">{request.status}</td>
                    <td className="px-4 py-3">{request.reason}</td>
                    <td className="px-4 py-3">
                      {request.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => void cancelRequest(request.id)}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
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

export default function EmployeeHistoryPage() {
  return (
    <RequireAuth roles={["EMPLOYEE"]}>
      <EmployeeHistoryContent />
    </RequireAuth>
  );
}
