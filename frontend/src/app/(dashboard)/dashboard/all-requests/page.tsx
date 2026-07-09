'use client';

import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Download, FilterX, FileText, ExternalLink } from 'lucide-react';
import { handleViewAttachment } from '@/lib/attachment';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/lib/auth';

function RequestsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="h-10 w-1/3 bg-muted animate-pulse rounded-md" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>
      <div className="h-[500px] w-full bg-muted animate-pulse rounded-xl" />
    </div>
  );
}

export default function AllRequestsPage() {
  const { user: currentUser } = useAuth();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const res = await api.get('/leave-requests');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Derived state
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();

    return requests.filter((r: any) => {
      const fullName = `${r.user.firstName} ${r.user.lastName}`.toLowerCase();
      const typeName = r.leaveType.name.toLowerCase();
      const reason = r.reason.toLowerCase();
      
      const matchesSearch = !lowerSearch || fullName.includes(lowerSearch) || typeName.includes(lowerSearch) || reason.includes(lowerSearch);
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, deferredSearchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  
  const paginatedRequests = useMemo(() => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    const start = (validPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize, totalPages]);

  useEffect(() => { 
    setPage(1); 
  }, [deferredSearchTerm, statusFilter, pageSize]);

  const handleExportCSV = () => {
    if (filteredRequests.length === 0) return;
    const headers = ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Status', 'Reason', 'Applied On'];
    const csvContent = [
      headers.join(','),
      ...filteredRequests.map((r: any) => [
        `"${r.user.firstName} ${r.user.lastName}"`,
        `"${r.leaveType.name}"`,
        `"${new Date(r.startDate).toLocaleDateString()}"`,
        `"${new Date(r.endDate).toLocaleDateString()}"`,
        `"${r.status}"`,
        `"${r.reason.replace(/"/g, '""')}"`,
        `"${new Date(r.createdAt).toLocaleDateString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `all_leave_requests_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-destructive font-bold">UNAUTHORIZED ACCESS</div>;
  }

  if (isLoading) return <RequestsSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Leave Requests</h1>
          <p className="text-muted-foreground mt-1">View all employee leave applications across the organization</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} disabled={filteredRequests.length === 0} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <Card className="glass overflow-hidden">
        <CardHeader className="pb-3 border-b bg-card/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle>All Requests</CardTitle>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search employee, type, or reason..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm pl-8 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              {(searchTerm || statusFilter !== 'ALL') && (
                <button onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }} className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold">No requests found</h3>
              <p className="text-muted-foreground">Adjust your filters to see more results.</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3 font-medium tracking-wider">Employee</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Leave Type</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Dates</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Status</th>
                      <th className="px-6 py-3 font-medium tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedRequests.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium whitespace-nowrap">
                          {r.user.firstName} {r.user.lastName}
                          <div className="text-xs text-muted-foreground font-normal">{r.user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{r.leaveType.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                          {new Date(r.startDate).toLocaleDateString()} &rarr; {new Date(r.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button onClick={() => setSelectedRequest(r)} className="text-primary hover:underline text-sm font-medium">
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground p-4 border-t bg-muted/20">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 rounded border bg-background px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredRequests.length)} of {filteredRequests.length}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-muted transition-colors">Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-muted transition-colors">Next</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Read-Only Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card p-6 rounded-xl shadow-xl border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Leave Request Details</h2>
                <p className="text-sm text-muted-foreground mt-1">Submitted on {new Date(selectedRequest.createdAt).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={selectedRequest.status} />
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Employee</h4>
                  <p className="font-medium">{selectedRequest.user.firstName} {selectedRequest.user.lastName}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Leave Type</h4>
                  <p className="font-medium">{selectedRequest.leaveType.name}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Duration</h4>
                <p className="font-medium">
                  {new Date(selectedRequest.startDate).toLocaleDateString()} to {new Date(selectedRequest.endDate).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</h4>
                <div className="p-3 bg-muted/50 rounded-md text-sm border mt-1">
                  {selectedRequest.reason}
                </div>
              </div>
              
              {selectedRequest.attachmentUrl && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Medical Certificate</h4>
                  <button onClick={() => handleViewAttachment(selectedRequest.id)} className="inline-flex items-center text-primary hover:underline text-sm font-medium mt-1">
                    <ExternalLink className="mr-1 h-4 w-4" /> View Attachment
                  </button>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Manager Comment</h4>
                {!selectedRequest.managerComment || selectedRequest.managerComment.trim() === '' ? (
                  <div className="text-sm text-muted-foreground italic mt-1">
                    No manager comment provided.
                  </div>
                ) : (
                  <div 
                    className="p-4 rounded-lg text-sm border mt-1 h-auto"
                    style={{ 
                      backgroundColor: '#FFFBEB',
                      borderColor: '#F59E0B',
                      color: '#78350F',
                      fontWeight: 600,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {selectedRequest.managerComment}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
              <button onClick={() => setSelectedRequest(null)} className="h-10 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
