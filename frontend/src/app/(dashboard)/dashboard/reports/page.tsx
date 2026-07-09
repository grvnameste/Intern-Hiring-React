'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Download, FilterX, BarChart3, CalendarDays, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>
      <div className="h-[500px] w-full bg-muted animate-pulse rounded-xl" />
    </div>
  );
}

export default function ReportsPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'BALANCES' | 'CALENDAR'>('SUMMARY');
  
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Tab 2 Filters
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');

  // Tab 3 State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['admin-reports-summary'],
    queryFn: async () => {
      const res = await api.get('/reports/summary');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN' && activeTab === 'SUMMARY',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN',
  });

  const { data: balancesData, isLoading: loadingBalances } = useQuery({
    queryKey: ['admin-reports-balances'],
    queryFn: async () => {
      const res = await api.get('/reports/balances');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN' && activeTab === 'BALANCES',
  });

  const { data: calendarData, isLoading: loadingCalendar } = useQuery({
    queryKey: ['admin-reports-calendar'],
    queryFn: async () => {
      const res = await api.get('/reports/calendar');
      return res.data.data;
    },
    enabled: currentUser?.role === 'ADMIN' && activeTab === 'CALENDAR',
  });

  // Tab 1: SUMMARY
  const summaryByLeaveType = useMemo(() => {
    if (!summaryData) return [];
    const grouped = summaryData.reduce((acc: any, curr: any) => {
      acc[curr.leaveTypeName] = (acc[curr.leaveTypeName] || 0) + curr.totalRequests;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [summaryData]);

  const summaryByStatus = useMemo(() => {
    if (!summaryData) return [];
    const grouped = summaryData.reduce((acc: any, curr: any) => {
      acc[curr.status] = (acc[curr.status] || 0) + curr.totalRequests;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [summaryData]);

  const summaryByEmployee = useMemo(() => {
    if (!summaryData) return [];
    const grouped = summaryData.reduce((acc: any, curr: any) => {
      if (!acc[curr.employeeName]) {
        acc[curr.employeeName] = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0, total: 0 };
      }
      acc[curr.employeeName][curr.status] += curr.totalRequests;
      acc[curr.employeeName].total += curr.totalRequests;
      return acc;
    }, {});
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();
    
    return Object.entries(grouped)
      .map(([name, data]: [string, any]) => ({ name, ...data }))
      .filter((emp: any) => !lowerSearch || emp.name.toLowerCase().includes(lowerSearch))
      .sort((a, b) => b.total - a.total);
  }, [summaryData, deferredSearchTerm]);

  // Tab 2: BALANCES
  const uniqueDepartments = useMemo(() => {
    if (!departments) return ['Unassigned'];
    return ['Unassigned', ...departments.map((d: any) => d.name)];
  }, [departments]);

  const uniqueLeaveTypes = useMemo(() => {
    if (!balancesData) return [];
    const types = new Set(balancesData.map((b: any) => b.leaveType.name));
    return Array.from(types) as string[];
  }, [balancesData]);

  const filteredBalances = useMemo(() => {
    if (!balancesData) return [];
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();
    return balancesData.filter((item: any) => {
      const depName = item.user.department?.name || 'Unassigned';
      
      const matchesSearch = !lowerSearch || 
        `${item.user.firstName} ${item.user.lastName}`.toLowerCase().includes(lowerSearch) || 
        item.leaveType.name.toLowerCase().includes(lowerSearch);
        
      const matchesDep = departmentFilter === 'ALL' || depName === departmentFilter;
      const matchesType = leaveTypeFilter === 'ALL' || item.leaveType.name === leaveTypeFilter;

      return matchesSearch && matchesDep && matchesType;
    });
  }, [balancesData, deferredSearchTerm, departmentFilter, leaveTypeFilter]);

  // Tab 3: CALENDAR
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const getLeavesForDay = (day: Date) => {
    if (!calendarData) return [];
    return calendarData.filter((leave: any) => {
      const start = parseISO(leave.startDate);
      const end = parseISO(leave.endDate);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  // EXPORTS
  const exportSummaryCSV = () => {
    api.post('/reports/export', { type: 'SUMMARY' }).catch(() => {}); // Optional tracking endpoint, ignore errors
    
    const headers = ['Employee', 'Total Leaves', 'Approved', 'Rejected', 'Pending', 'Cancelled'];
    const csvContent = [
      headers.join(','),
      ...summaryByEmployee.map((item: any) => [
        `"${item.name}"`,
        item.total,
        item.APPROVED,
        item.REJECTED,
        item.PENDING,
        item.CANCELLED
      ].join(','))
    ].join('\n');
    downloadCSV(csvContent, 'leave_summary_report');
  };

  const exportBalancesCSV = () => {
    api.post('/reports/export', { type: 'BALANCES' }).catch(() => {});
    
    const headers = ['Employee', 'Department', 'Leave Type', 'Total Days', 'Used Days', 'Remaining Days'];
    const csvContent = [
      headers.join(','),
      ...filteredBalances.map((item: any) => [
        `"${item.user.firstName} ${item.user.lastName}"`,
        `"${item.user.department?.name || 'Unassigned'}"`,
        `"${item.leaveType.name}"`,
        item.totalDays,
        item.usedDays,
        item.totalDays - item.usedDays
      ].join(','))
    ].join('\n');
    downloadCSV(csvContent, 'leave_balances_report');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-destructive font-bold">UNAUTHORIZED ACCESS</div>;
  }

  const isLoading = (activeTab === 'SUMMARY' && loadingSummary) || 
                    (activeTab === 'BALANCES' && loadingBalances) || 
                    (activeTab === 'CALENDAR' && loadingCalendar);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Exportable reports for leave data analysis</p>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button 
          onClick={() => { setActiveTab('SUMMARY'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'SUMMARY' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <BarChart3 className="h-4 w-4" /> Leave Summary
        </button>
        <button 
          onClick={() => { setActiveTab('BALANCES'); setSearchTerm(''); setDepartmentFilter('ALL'); setLeaveTypeFilter('ALL'); }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'BALANCES' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Wallet className="h-4 w-4" /> Leave Balances
        </button>
        <button 
          onClick={() => { setActiveTab('CALENDAR'); }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'CALENDAR' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <CalendarDays className="h-4 w-4" /> Leave Calendar
        </button>
      </div>

      {isLoading ? (
        <ReportsSkeleton />
      ) : (
        <div className="space-y-6">
          
          {/* SUMMARY TAB */}
          {activeTab === 'SUMMARY' && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="glass">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">By Leave Type</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryByLeaveType.map(item => (
                        <div key={item.name} className="flex justify-between items-center text-sm border-b pb-1 last:border-0">
                          <span className="font-medium">{item.name as string}</span>
                          <span className="font-bold">{item.count as number}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">By Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryByStatus.map(item => (
                        <div key={item.name} className="flex justify-between items-center text-sm border-b pb-1 last:border-0">
                          <span className="font-medium capitalize">{(item.name as string).toLowerCase()}</span>
                          <span className="font-bold">{item.count as number}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass overflow-hidden">
                <CardHeader className="pb-3 border-b bg-card/50">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <CardTitle>By Employee</CardTitle>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input type="text" placeholder="Search employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm pl-8 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                      </div>
                      <button onClick={exportSummaryCSV} disabled={summaryByEmployee.length === 0} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 disabled:opacity-50">
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 p-0 overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs sticky top-0">
                      <tr>
                        <th className="px-6 py-3 font-medium">Employee</th>
                        <th className="px-6 py-3 font-medium text-right">Total Leaves</th>
                        <th className="px-6 py-3 font-medium text-right">Approved</th>
                        <th className="px-6 py-3 font-medium text-right">Rejected</th>
                        <th className="px-6 py-3 font-medium text-right">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summaryByEmployee.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No data available</td></tr>
                      ) : (
                        summaryByEmployee.map((item: any, _idx: number) => (
                          <tr key={_idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-3 font-medium">{item.name}</td>
                            <td className="px-6 py-3 text-right font-bold">{item.total}</td>
                            <td className="px-6 py-3 text-right text-green-600">{item.APPROVED}</td>
                            <td className="px-6 py-3 text-right text-red-600">{item.REJECTED}</td>
                            <td className="px-6 py-3 text-right text-yellow-600">{item.PENDING}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}

          {/* BALANCES TAB */}
          {activeTab === 'BALANCES' && (
            <Card className="glass overflow-hidden">
              <CardHeader className="pb-3 border-b bg-card/50">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <CardTitle>Leave Balance Report</CardTitle>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input type="text" placeholder="Search employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm pl-8 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    
                    <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="ALL">All Departments</option>
                      {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    <select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="ALL">All Leave Types</option>
                      {uniqueLeaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    {(searchTerm || departmentFilter !== 'ALL' || leaveTypeFilter !== 'ALL') && (
                      <button onClick={() => { setSearchTerm(''); setDepartmentFilter('ALL'); setLeaveTypeFilter('ALL'); }} className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                        <FilterX className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button onClick={exportBalancesCSV} disabled={filteredBalances.length === 0} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 disabled:opacity-50">
                      <Download className="mr-2 h-4 w-4" /> Export CSV
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 p-0 overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs sticky top-0">
                    <tr>
                      <th className="px-6 py-3 font-medium">Employee</th>
                      <th className="px-6 py-3 font-medium">Department</th>
                      <th className="px-6 py-3 font-medium">Leave Type</th>
                      <th className="px-6 py-3 font-medium text-right">Total Days</th>
                      <th className="px-6 py-3 font-medium text-right">Used</th>
                      <th className="px-6 py-3 font-medium text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBalances.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No data available</td></tr>
                    ) : (
                      filteredBalances.map((item: any) => {
                        const remaining = item.totalDays - item.usedDays;
                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-3 font-medium">
                              {item.user.firstName} {item.user.lastName}
                            </td>
                            <td className="px-6 py-3 text-xs">{item.user.department?.name || 'Unassigned'}</td>
                            <td className="px-6 py-3">{item.leaveType.name}</td>
                            <td className="px-6 py-3 text-right">{item.totalDays}</td>
                            <td className="px-6 py-3 text-right text-orange-600 dark:text-orange-400 font-medium">{item.usedDays}</td>
                            <td className={`px-6 py-3 text-right font-bold ${remaining <= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{remaining}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* CALENDAR TAB */}
          {activeTab === 'CALENDAR' && (
            <Card className="glass overflow-hidden">
              <CardHeader className="pb-3 border-b bg-card/50">
                <div className="flex items-center justify-between">
                  <CardTitle>Approved Leaves Calendar</CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-md hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="font-bold w-32 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-md hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
                    <button onClick={() => setCurrentMonth(new Date())} className="ml-2 px-3 py-1 text-xs border rounded-md hover:bg-muted">Today</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 bg-muted/20 gap-px border-b">
                  {calendarDays.map((day, idx) => {
                    const leaves = getLeavesForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    return (
                      <div key={day.toISOString()} className={`min-h-[100px] p-2 bg-background ${!isCurrentMonth ? 'opacity-40' : ''}`}>
                        <div className={`text-right text-xs font-medium mb-1 ${isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {leaves.map((leave: any) => (
                            <div 
                              key={leave.id} 
                              className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                              title={`${leave.user.firstName} ${leave.user.lastName} - ${leave.leaveType.name}\n${format(parseISO(leave.startDate), 'MMM d')} to ${format(parseISO(leave.endDate), 'MMM d')}`}
                            >
                              {leave.user.firstName} {leave.user.lastName.charAt(0)}.
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}
