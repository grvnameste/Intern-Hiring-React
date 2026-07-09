'use client';

import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ExpandableComment } from '@/components/ExpandableComment';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Search, Download, FilterX, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function HistoryPage() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['employee-requests'],
    queryFn: async () => {
      const res = await api.get('/leave-requests');
      return res.data.data;
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Extract unique leave types for filter dropdown
  const uniqueLeaveTypes = useMemo(() => {
    if (!requests) return [];
    const types = new Set(requests.map((r: any) => r.leaveType.name));
    return Array.from(types) as string[];
  }, [requests]);

  // Filter logic
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();

    return requests.filter((req: any) => {
      const matchesSearch = !lowerSearch ||
        req.reason?.toLowerCase().includes(lowerSearch) || 
        req.managerComment?.toLowerCase().includes(lowerSearch) ||
        req.leaveType.name.toLowerCase().includes(lowerSearch);
        
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchesType = leaveTypeFilter === 'ALL' || req.leaveType.name === leaveTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, deferredSearchTerm, statusFilter, leaveTypeFilter]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  
  const paginatedRequests = useMemo(() => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    const start = (validPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize, totalPages]);

  // Reset page when filters change
  useEffect(() => { 
    setPage(1); 
  }, [deferredSearchTerm, statusFilter, leaveTypeFilter, pageSize]);

  const handleExportCSV = () => {
    if (filteredRequests.length === 0) return;

    const headers = ['Leave Type', 'Start Date', 'End Date', 'Reason', 'Status', 'Manager Comment', 'Applied On'];
    const csvContent = [
      headers.join(','),
      ...filteredRequests.map((req: any) => {
        return [
          `"${req.leaveType.name}"`,
          `"${new Date(req.startDate).toLocaleDateString()}"`,
          `"${new Date(req.endDate).toLocaleDateString()}"`,
          `"${(req.reason || '').replace(/"/g, '""')}"`,
          `"${req.status}"`,
          `"${(req.managerComment || '').replace(/"/g, '""')}"`,
          `"${new Date(req.createdAt).toLocaleDateString()}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leave_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCancelClick = (id: string) => {
    setRequestToCancel(id);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!requestToCancel) return;
    setIsCancelling(true);
    try {
      await api.post(`/leave-requests/${requestToCancel}/cancel`);
      toast.success('Leave request cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['employee-requests'] });
      setCancelModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel leave request');
    } finally {
      setIsCancelling(false);
      setRequestToCancel(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-1/4 bg-muted animate-pulse rounded-md" />
        <div className="h-[500px] w-full bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave History</h1>
          <p className="text-muted-foreground mt-1">View your past and current leave requests</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredRequests.length === 0}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </button>
      </div>

      <Card className="glass">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle>All Requests</CardTitle>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search reason or comment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pl-8"
                />
              </div>
              
              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Types</option>
                {uniqueLeaveTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {(searchTerm || statusFilter !== 'ALL' || leaveTypeFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                    setLeaveTypeFilter('ALL');
                  }}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium text-muted-foreground hover:text-foreground h-9 px-3"
                  title="Clear filters"
                >
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold">No requests found</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                {requests?.length === 0 
                  ? "You haven't submitted any leave requests yet."
                  : "No requests match your current search and filter criteria."}
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="rounded-md border">
                <div className="w-full overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium">Leave Type</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Manager Comment</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedRequests.map((req: any) => (
                        <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4 font-medium align-middle">{req.leaveType.name}</td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 max-w-[200px] align-middle" title={req.reason}>
                            <div className="truncate">{req.reason}</div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <StatusBadge status={req.status} />
                          </td>
                          <td className="px-4 py-4 align-middle max-w-[300px]">
                            <ExpandableComment comment={req.managerComment} />
                          </td>
                          <td className="px-4 py-4 align-middle text-right">
                            {req.status === 'PENDING' && (
                              <button
                                onClick={() => handleCancelClick(req.id)}
                                className="text-sm font-medium text-destructive hover:underline"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>rows per page</span>
                </div>

                <div className="flex items-center gap-4">
                  <span>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredRequests.length)} of {filteredRequests.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || totalPages === 0}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this leave request? This action cannot be undone."
        onConfirm={handleConfirmCancel}
        onCancel={() => {
          setCancelModalOpen(false);
          setRequestToCancel(null);
        }}
        confirmText="Yes, Cancel"
        isLoading={isCancelling}
      />
    </div>
  );
}
