"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../components/DashboardShell";
import { RequireAuth, useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { LeaveRequest, LeaveStatus } from "../../lib/types";

function ManagerRequestsContent() {
  const { notify } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "PENDING"),
    [requests],
  );

  const loadRequests = async () => {
    setLoading(true);
    try {
      setRequests(await apiFetch<LeaveRequest[]>("/api/leave-requests"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load team requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadRequests());
  }, []);

  const updateStatus = async (id: string, status: Extract<LeaveStatus, "APPROVED" | "REJECTED">) => {
    try {
      await apiFetch(`/api/leave-requests/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      notify("success", `Request ${status.toLowerCase()}`);
      await loadRequests();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Unable to update request");
    }
  };

  return (
    <DashboardShell title="Team leave requests" description="Review requests from your direct team members.">
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total requests</p>
          <p className="mt-2 text-3xl font-semibold">{requests.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-semibold">{pendingRequests.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="mt-2 text-3xl font-semibold">
            {requests.filter((request) => request.status === "APPROVED").length}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        {loading ? <p className="p-5 text-sm text-slate-600">Loading...</p> : null}
        {error ? <p className="p-5 text-sm text-red-700">{error}</p> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{request.user?.name}</td>
                  <td className="px-4 py-3">{request.leaveType?.name}</td>
                  <td className="px-4 py-3">
                    {request.startDate.slice(0, 10)} to {request.endDate.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">{request.status}</td>
                  <td className="px-4 py-3">{request.reason}</td>
                  <td className="px-4 py-3">
                    {request.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void updateStatus(request.id, "APPROVED")}
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateStatus(request.id, "REJECTED")}
                          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

export default function ManagerRequestsPage() {
  return (
    <RequireAuth roles={["MANAGER"]}>
      <ManagerRequestsContent />
    </RequireAuth>
  );
}
