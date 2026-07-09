'use client';

import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Search, Download, Plus, Edit, Trash2, Briefcase } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuth } from '@/lib/auth';

const leaveTypeSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  defaultDays: z.number().min(0, 'Days must be at least 0'),
  requiresAttachment: z.boolean(),
});

type LeaveTypeForm = z.infer<typeof leaveTypeSchema>;

function LeaveTypesSkeleton() {
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

export default function LeaveTypesPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: leaveTypes, isLoading } = useQuery({
    queryKey: ['admin-leave-types'],
    queryFn: async () => {
      const res = await api.get('/leave-types');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LeaveTypeForm>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: { requiresAttachment: false, defaultDays: 0 }
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeaveTypeForm) => await api.post('/leave-types', data),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<LeaveTypeForm> }) => await api.put(`/leave-types/${id}`, data),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/leave-types/${id}`),
  });

  // Derived state
  const filteredTypes = useMemo(() => {
    if (!leaveTypes) return [];
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();

    return leaveTypes.filter((t: any) => {
      const matchesSearch = !lowerSearch || t.name.toLowerCase().includes(lowerSearch) || (t.description || '').toLowerCase().includes(lowerSearch);
      return matchesSearch;
    });
  }, [leaveTypes, deferredSearchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / pageSize));
  
  const paginatedTypes = useMemo(() => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    const start = (validPage - 1) * pageSize;
    return filteredTypes.slice(start, start + pageSize);
  }, [filteredTypes, page, pageSize, totalPages]);

  useEffect(() => { 
    setPage(1); 
  }, [deferredSearchTerm, pageSize]);

  const openCreate = () => {
    reset({ name: '', description: '', defaultDays: 0, requiresAttachment: false });
    setEditingType(null);
    setIsFormOpen(true);
  };

  const openEdit = (type: any) => {
    reset({
      name: type.name,
      description: type.description || '',
      defaultDays: type.defaultDays,
      requiresAttachment: type.requiresAttachment,
    });
    setEditingType(type);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: LeaveTypeForm) => {
    try {
      if (editingType) {
        await updateMutation.mutateAsync({ id: editingType.id, data });
        toast.success('Leave type and policies updated successfully', { id: 'type-update' });
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Leave type created successfully', { id: 'type-create' });
      }
      setIsFormOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-leave-types'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed', { id: 'type-error' });
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await deleteMutation.mutateAsync(typeToDelete.id);
      toast.success('Leave type deleted successfully', { id: 'type-delete' });
      setIsDeleteModalOpen(false);
      setTypeToDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-leave-types'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete leave type', { id: 'type-delete-error' });
    }
  };

  const handleExportCSV = () => {
    if (filteredTypes.length === 0) return;
    const headers = ['Name', 'Description', 'Default Days', 'Requires Attachment'];
    const csvContent = [
      headers.join(','),
      ...filteredTypes.map((t: any) => [
        `"${t.name}"`,
        `"${t.description || ''}"`,
        t.defaultDays,
        t.requiresAttachment ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leave_types_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-destructive font-bold">UNAUTHORIZED ACCESS</div>;
  }

  if (isLoading) return <LeaveTypesSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Types & Policies</h1>
          <p className="text-muted-foreground mt-1">Manage leave types and their default allowance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} disabled={filteredTypes.length === 0} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-sm transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Add Leave Type
          </button>
        </div>
      </div>

      <Card className="glass overflow-hidden">
        <CardHeader className="pb-3 border-b bg-card/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle>Leave Types</CardTitle>
            <div className="relative flex-1 md:w-64 md:flex-none">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search leave types..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm pl-8 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          {filteredTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold">No leave types found</h3>
              <p className="text-muted-foreground">Adjust your search or create a new leave type.</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3 font-medium tracking-wider">Name</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Description</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Max Days</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Requires Attachment</th>
                      <th className="px-6 py-3 font-medium tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedTypes.map((t: any) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium whitespace-nowrap">{t.name}</td>
                        <td className="px-6 py-4 max-w-xs truncate">{t.description || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{t.defaultDays}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{t.requiresAttachment ? 'Yes' : 'No'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button onClick={() => openEdit(t)} className="p-2 text-primary hover:bg-muted rounded-md transition-colors" title="Edit">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => { setTypeToDelete(t); setIsDeleteModalOpen(true); }} className="p-2 text-destructive hover:bg-muted rounded-md transition-colors" title="Delete">
                            <Trash2 className="h-4 w-4" />
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
                  <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredTypes.length)} of {filteredTypes.length}</span>
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

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card p-6 rounded-xl shadow-xl border animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold tracking-tight mb-6">{editingType ? 'Edit Leave Type' : 'Create Leave Type'}</h2>
            {editingType && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm text-yellow-600">
                <strong>Warning:</strong> Modifying the Max Days will immediately update the leave balances for all employees for the current year.
              </div>
            )}
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input {...register('name')} className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                {errors.name && <p className="text-xs text-destructive font-medium">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea {...register('description')} className="w-full border rounded-md p-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]" />
                {errors.description && <p className="text-xs text-destructive font-medium">{errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Days Per Year</label>
                <input {...register('defaultDays', { valueAsNumber: true })} type="number" min="0" className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                {errors.defaultDays && <p className="text-xs text-destructive font-medium">{errors.defaultDays.message}</p>}
              </div>
              <div className="flex items-center space-x-2 mt-4">
                <input {...register('requiresAttachment')} type="checkbox" id="requiresAttachment" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <label htmlFor="requiresAttachment" className="text-sm font-medium">
                  Requires Medical Certificate / Attachment
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSubmitting} className="h-10 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="h-10 inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 shadow-sm transition-colors disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Leave Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Leave Type"
        message={`Are you sure you want to delete ${typeToDelete?.name}? This action cannot be undone and may cause issues if existing leaves are linked to this type.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
