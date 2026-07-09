'use client';

import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, CheckCircle, XCircle, Clock, Shield, UserCog, Briefcase } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
      </div>
      <div className="h-[400px] w-full bg-muted animate-pulse rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.firstName} {user?.lastName}
        </p>
      </div>

      {user?.role === 'ADMIN' && <AdminDashboard />}
      {user?.role === 'MANAGER' && <ManagerDashboard />}
      {user?.role === 'EMPLOYEE' && <EmployeeDashboard />}
    </div>
  );
}

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/reports/stats');
      return res.data.data;
    }
  });

  const { data: trends } = useQuery({
    queryKey: ['admin-trends'],
    queryFn: async () => {
      const res = await api.get('/reports/trends');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return res.data.data.map((count: number, index: number) => ({
        name: months[index],
        requests: count
      }));
    }
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Employees" value={stats?.totalEmployees || 0} icon={Users} color="text-blue-500" />
        <StatsCard title="Total Managers" value={stats?.totalManagers || 0} icon={UserCog} color="text-purple-500" />
        <StatsCard title="Total Admins" value={stats?.totalAdmins || 0} icon={Shield} color="text-red-500" />
        <StatsCard title="Total Leave Types" value={stats?.totalLeaveTypes || 0} icon={Briefcase} color="text-indigo-500" />
        
        <StatsCard title="Total Requests" value={stats?.totalLeaveRequests || 0} icon={FileText} color="text-cyan-500" />
        <StatsCard title="Pending Requests" value={stats?.pendingRequests || 0} icon={Clock} color="text-yellow-500" />
        <StatsCard title="Approved Leaves" value={stats?.approvedRequests || 0} icon={CheckCircle} color="text-green-500" />
        <StatsCard title="Rejected Leaves" value={stats?.rejectedRequests || 0} icon={XCircle} color="text-orange-500" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Leave Trends (Approved)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trends && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['manager-requests'],
    queryFn: async () => {
      const res = await api.get('/leave-requests');
      return res.data.data;
    }
  });

  if (isLoading) return <DashboardSkeleton />;

  const pendingCount = requests?.filter((r: any) => r.status === 'PENDING').length || 0;
  const approvedRequests = requests?.filter((r: any) => r.status === 'APPROVED').length || 0;
  const rejectedRequests = requests?.filter((r: any) => r.status === 'REJECTED').length || 0;

  const pendingRequests = [...(requests?.filter((r: any) => r.status === 'PENDING') || [])]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Pending Reviews" value={pendingCount} icon={Clock} color="text-yellow-500" />
        <StatsCard title="Approved Requests" value={approvedRequests} icon={CheckCircle} color="text-green-500" />
        <StatsCard title="Rejected Requests" value={rejectedRequests} icon={XCircle} color="text-red-500" />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Recent Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending requests to review.</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.slice(0, 5).map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                  <div>
                    <p className="font-medium">{req.user.firstName} {req.user.lastName}</p>
                    <p className="text-sm text-muted-foreground">{req.leaveType.name} &bull; {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      Pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeDashboard() {
  const { data: balances, isLoading: loadingBalances } = useQuery({
    queryKey: ['employee-balances'],
    queryFn: async () => {
      const res = await api.get('/leave-requests/balances');
      return res.data.data;
    }
  });

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ['employee-requests'],
    queryFn: async () => {
      const res = await api.get('/leave-requests');
      return res.data.data;
    }
  });

  if (loadingBalances || loadingRequests) return <DashboardSkeleton />;

  const pendingRequests = requests?.filter((r: any) => r.status === 'PENDING').length || 0;
  const approvedRequests = requests?.filter((r: any) => r.status === 'APPROVED').length || 0;
  const rejectedRequests = requests?.filter((r: any) => r.status === 'REJECTED').length || 0;
  const totalApplications = pendingRequests + approvedRequests + rejectedRequests;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Applications" value={totalApplications} icon={FileText} color="text-blue-500" />
        <StatsCard title="Pending Requests" value={pendingRequests} icon={Clock} color="text-yellow-500" />
        <StatsCard title="Approved" value={approvedRequests} icon={CheckCircle} color="text-green-500" />
        <StatsCard title="Rejected" value={rejectedRequests} icon={XCircle} color="text-red-500" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {balances?.map((balance: any) => (
          <Card key={balance.id} className="glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {balance.leaveType.name} Balance
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{balance.totalDays - balance.usedDays} Days</div>
              <p className="text-xs text-muted-foreground mt-1">
                {balance.usedDays} used out of {balance.totalDays} total
              </p>
              <div className="mt-4 h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all" 
                  style={{ width: `${(balance.usedDays / balance.totalDays) * 100}%` }} 
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Recent Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          {requests?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No leave requests found.</p>
          ) : (
            <div className="space-y-4">
              {requests?.slice(0, 5).map((req: any) => (
                <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card/50">
                  <div>
                    <p className="font-medium">{req.leaveType.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm mt-1">{req.reason}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

import { StatusBadge } from '@/components/StatusBadge';
