'use client';

import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import { Loader2, Check, X, Search, Download, FilterX, FileText } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExpandableComment } from '@/components/ExpandableComment';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { handleViewAttachment } from '@/lib/attachment';

const processSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  managerComment: z.string().optional(),
}).refine(data => {
  if (data.status === 'REJECTED' && (!data.managerComment || data.managerComment.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Manager comment is required when rejecting",
  path: ["managerComment"],
});

type ProcessForm = z.infer<typeof processSchema>;

export default function TeamRequestsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['manager-requests'],
    queryFn: async () => {
      const res = await api.get('/leave-requests');
      return res.data.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: ProcessForm }) => {
      return await api.patch(`/leave-requests/${id}/process`, data);
    }
  });

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ProcessForm | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const confirmAction = async () => {
    if (!modalData || !selectedRequest) return;
    
    try {
      setIsProcessing(true);
      await mutation.mutateAsync({ id: selectedRequest.id, data: modalData });
      
      const statusText = modalData.status === 'APPROVED' ? 'approved' : 'rejected';
      toast.success(`Leave request ${statusText} successfully.`, { id: 'process-success' });
      
      queryClient.setQueryData(['manager-requests'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((req: any) => 
          req.id === selectedRequest.id ? { ...req, status: modalData.status, managerComment: modalData.managerComment } : req
        );
      });
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['manager-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-balances'] }),
      ]);
      
      setSelectedRequest(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process request', { id: 'process-error' });
    } finally {
      setIsProcessing(false);
      setIsModalOpen(false);
      setModalData(null);
    }
  };

  const uniqueLeaveTypes = useMemo(() => {
    if (!requests) return [];
    const types = new Set(requests.map((r: any) => r.leaveType.name));
    return Array.from(types) as string[];
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();
    
    return requests.filter((req: any) => {
      const employeeName = `${req.user.firstName} ${req.user.lastName}`.toLowerCase();
      const matchesSearch = !lowerSearch ||
        employeeName.includes(lowerSearch) || 
        req.leaveType.name.toLowerCase().includes(lowerSearch) ||
        req.status.toLowerCase().includes(lowerSearch);
        
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchesType = leaveTypeFilter === 'ALL' || req.leaveType.name === leaveTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, deferredSearchTerm, statusFilter, leaveTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  
  const paginatedRequests = useMemo(() => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    const start = (validPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize, totalPages]);

  useEffect(() => { 
    setPage(1); 
  }, [deferredSearchTerm, statusFilter, leaveTypeFilter, pageSize]);

  const handleExportCSV = () => {
    if (filteredRequests.length === 0) return;

    const headers = ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Status', 'Manager Comment', 'Applied On'];
    const csvContent = [
      headers.join(','),
      ...filteredRequests.map((req: any) => {
        return [
          `"${req.user.firstName} ${req.user.lastName}"`,
          `"${req.leaveType.name}"`,
          `"${new Date(req.startDate).toLocaleDateString()}"`,
          `"${new Date(req.endDate).toLocaleDateString()}"`,
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
    link.setAttribute('download', `team_requests_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-1/3 bg-muted animate-pulse rounded-md" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 h-[500px] bg-muted animate-pulse rounded-xl" />
          <div className="h-[400px] bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Leave Requests</h1>
          <p className="text-muted-foreground mt-1">Review and manage your team's leave requests</p>
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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card className="glass h-full">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <CardTitle>All Team Requests</CardTitle>
                
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                  <div className="relative flex-1 min-w-[150px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search employee..."
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
                      ? "Your team hasn't submitted any leave requests yet."
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
                            <th className="px-4 py-3 font-medium">Employee</th>
                            <th className="px-4 py-3 font-medium">Leave Type</th>
                            <th className="px-4 py-3 font-medium">Duration</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Manager Comment</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {paginatedRequests.map((req: any) => (
                            <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-4 font-medium align-middle">{req.user.firstName} {req.user.lastName}</td>
                              <td className="px-4 py-4 align-middle">{req.leaveType.name}</td>
                              <td className="px-4 py-4 whitespace-nowrap align-middle">
                                {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <StatusBadge status={req.status} />
                              </td>
                              <td className="px-4 py-4 align-middle max-w-[250px]">
                                <ExpandableComment comment={req.managerComment} />
                              </td>
                              <td className="px-4 py-4 align-middle">
                                {req.status === 'PENDING' ? (
                                  <button
                                    onClick={() => setSelectedRequest(req)}
                                    className="text-primary hover:underline text-xs font-medium"
                                  >
                                    Review
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Processed</span>
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
        </div>

        {/* Review Panel */}
        <div>
          {selectedRequest ? (
            <Card className="glass sticky top-6 border-primary/20">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-lg">Review Request</CardTitle>
                <div className="text-sm mt-1">
                  <span className="font-semibold">{selectedRequest.user.firstName} {selectedRequest.user.lastName}</span>
                  <p className="text-muted-foreground">{selectedRequest.leaveType.name}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Employee</p>
                    <p className="text-sm font-medium">{selectedRequest.user.firstName} {selectedRequest.user.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Leave Type</p>
                    <p className="text-sm font-medium">{selectedRequest.leaveType.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Leave Dates</p>
                  <p className="text-sm font-medium">{new Date(selectedRequest.startDate).toLocaleDateString()} to {new Date(selectedRequest.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Reason</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-md mt-1 border break-words whitespace-pre-wrap">{selectedRequest.reason}</p>
                </div>
                
                {selectedRequest.attachmentUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Medical Certificate</p>
                    <div className="mt-2 border rounded-md p-3 bg-muted/30 flex items-center gap-4">
                      {selectedRequest.attachmentUrl.startsWith('data:image') ? (
                        <img src={selectedRequest.attachmentUrl} alt="Medical Certificate" className="h-12 w-12 object-cover rounded-md border bg-white" />
                      ) : (
                        <div className="h-12 w-12 bg-red-100 text-red-600 rounded-md flex items-center justify-center font-bold text-xs border border-red-200">PDF</div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">
                          Medical_Certificate{selectedRequest.attachmentUrl.startsWith('data:image') ? '.jpg' : '.pdf'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <button onClick={() => handleViewAttachment(selectedRequest.id)} className="text-xs font-medium text-primary hover:underline">View</button>
                        <a href={selectedRequest.attachmentUrl} download={`Medical_Certificate${selectedRequest.attachmentUrl.startsWith('data:image') ? '.jpg' : '.pdf'}`} className="text-xs font-medium text-primary hover:underline">Download</a>
                      </div>
                    </div>
                  </div>
                )}
                
                <ProcessForm 
                  onSubmit={(data) => {
                    setModalData(data);
                    setIsModalOpen(true);
                  }}
                  isPending={isProcessing}
                  onCancel={() => setSelectedRequest(null)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="glass h-full flex items-center justify-center border-dashed">
              <CardContent className="text-center p-6 flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Check className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">Select a pending request to review</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      <ConfirmModal
        isOpen={isModalOpen}
        title={modalData?.status === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request'}
        message={`Are you sure you want to ${modalData?.status?.toLowerCase()} this leave request from ${selectedRequest?.user?.firstName}?`}
        onConfirm={confirmAction}
        onCancel={() => {
          setIsModalOpen(false);
          setModalData(null);
        }}
        isLoading={isProcessing}
        confirmText={modalData?.status === 'APPROVED' ? 'Approve' : 'Reject'}
      />
    </div>
  );
}

function ProcessForm({ onSubmit, isPending, onCancel }: { onSubmit: (data: ProcessForm) => void, isPending: boolean, onCancel: () => void }) {
  const { register, handleSubmit, setValue, trigger, formState: { errors } } = useForm<ProcessForm>({
    resolver: zodResolver(processSchema)
  });

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setValue('status', status);
    const isValid = await trigger();
    if (isValid) {
      handleSubmit((data) => onSubmit(data))();
    }
  };

  return (
    <form className="space-y-4 pt-4 border-t border-border">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase font-semibold">Manager Comment</label>
        <textarea
          {...register('managerComment')}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none overflow-hidden"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
          placeholder="Add a comment... (Required for rejection)"
        />
        {errors.managerComment && <p className="text-xs text-destructive">{errors.managerComment.message}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleAction('APPROVED')}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-500 hover:bg-green-600 text-white h-10 px-4 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Approve
        </button>
        <button
          type="button"
          onClick={() => handleAction('REJECTED')}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-red-500 hover:bg-red-600 text-white h-10 px-4 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
          Reject
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="w-full text-sm font-medium text-muted-foreground hover:text-foreground mt-2"
      >
        Cancel
      </button>
    </form>
  );
}
