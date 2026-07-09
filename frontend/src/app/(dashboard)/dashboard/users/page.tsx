'use client';

import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Search, Download, FilterX, UserPlus, Edit, Trash2, Users } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuth } from '@/lib/auth';

const userSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  managerId: z.string().uuid().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if ((data.role === 'EMPLOYEE' || data.role === 'MANAGER') && !data.departmentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Department is required for Employees and Managers',
      path: ['departmentId'],
    });
  }
});

type UserForm = z.infer<typeof userSchema>;

function UsersSkeleton() {
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

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: 'EMPLOYEE', managerId: '' }
  });

  const selectedRole = watch('role');

  const createMutation = useMutation({
    mutationFn: async (data: UserForm) => await api.post('/users', data),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<UserForm> }) => await api.put(`/users/${id}`, data),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/users/${id}`),
  });

  // Derived state
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();

    return users.filter((u: any) => {
      const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
      const matchesSearch = !lowerSearch || fullName.includes(lowerSearch) || u.email.toLowerCase().includes(lowerSearch);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, deferredSearchTerm, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  
  const paginatedUsers = useMemo(() => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    const start = (validPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize, totalPages]);

  useEffect(() => { 
    setPage(1); 
  }, [deferredSearchTerm, roleFilter, pageSize]);

  const openCreate = () => {
    reset({ firstName: '', lastName: '', email: '', password: '', role: 'EMPLOYEE', managerId: '', departmentId: '' });
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const openEdit = (user: any) => {
    reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || '',
      managerId: user.managerId || '',
    });
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: UserForm) => {
    try {
      const payload = { ...data };
      if (!payload.managerId) delete payload.managerId;
      if (!payload.departmentId) delete payload.departmentId;
      if (editingUser) {
        delete payload.password; // Admin does not update password here
        await updateMutation.mutateAsync({ id: editingUser.id, data: payload });
        toast.success('User updated successfully', { id: 'user-update' });
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('User created successfully', { id: 'user-create' });
      }
      setIsFormOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed', { id: 'user-error' });
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteMutation.mutateAsync(userToDelete.id);
      toast.success('User deleted successfully', { id: 'user-delete' });
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user', { id: 'user-delete-error' });
    }
  };

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) return;
    const headers = ['Name', 'Email', 'Role', 'Department', 'Status', 'Manager'];
    const csvContent = [
      headers.join(','),
      ...filteredUsers.map((u: any) => [
        `"${u.firstName} ${u.lastName}"`,
        `"${u.email}"`,
        `"${u.role}"`,
        `"${u.department?.name || 'None'}"`,
        `"${u.isActive ? 'Active' : 'Inactive'}"`,
        `"${u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : 'None'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-destructive font-bold">UNAUTHORIZED ACCESS</div>;
  }

  if (isLoading) return <UsersSkeleton />;

  const availableManagers = users?.filter((u: any) => u.role === 'MANAGER' || u.role === 'ADMIN') || [];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users, roles, and assignments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} disabled={filteredUsers.length === 0} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-sm transition-colors">
            <UserPlus className="mr-2 h-4 w-4" /> Add User
          </button>
        </div>
      </div>

      <Card className="glass overflow-hidden">
        <CardHeader className="pb-3 border-b bg-card/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle>All Users</CardTitle>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm pl-8 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="ALL">All Roles</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              {(searchTerm || roleFilter !== 'ALL') && (
                <button onClick={() => { setSearchTerm(''); setRoleFilter('ALL'); }} className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold">No users found</h3>
              <p className="text-muted-foreground">Adjust your filters to see more results.</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3 font-medium tracking-wider">Name</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Email</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Role</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Department</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Manager</th>
                      <th className="px-6 py-3 font-medium tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium whitespace-nowrap">{u.firstName} {u.lastName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                            ${u.role === 'ADMIN' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                              u.role === 'MANAGER' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' : 
                              'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{u.department?.name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button onClick={() => openEdit(u)} className="p-2 text-primary hover:bg-muted rounded-md transition-colors" title="Edit">
                            <Edit className="h-4 w-4" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button onClick={() => { setUserToDelete(u); setIsDeleteModalOpen(true); }} className="p-2 text-destructive hover:bg-muted rounded-md transition-colors" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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
                  <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length}</span>
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
            <h2 className="text-xl font-bold tracking-tight mb-6">{editingUser ? 'Edit User' : 'Create User'}</h2>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <input {...register('firstName')} className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  {errors.firstName && <p className="text-xs text-destructive font-medium">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <input {...register('lastName')} className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  {errors.lastName && <p className="text-xs text-destructive font-medium">{errors.lastName.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input {...register('email')} type="email" className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
              </div>
              {!editingUser && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <input {...register('password')} type="password" className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select {...register('role')} className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <select {...register('departmentId')} className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">None</option>
                  {departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.departmentId && <p className="text-xs text-destructive font-medium">{errors.departmentId.message}</p>}
              </div>
              {selectedRole === 'EMPLOYEE' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Manager</label>
                  <select {...register('managerId')} className="w-full h-10 border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">None</option>
                    {availableManagers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.role})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSubmitting} className="h-10 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="h-10 inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 shadow-sm transition-colors disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.firstName} ${userToDelete?.lastName}? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
