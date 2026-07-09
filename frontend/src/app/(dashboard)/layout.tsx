'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Calendar, Home, Users, FileText, Settings, Menu, X, BarChart } from 'lucide-react';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NotificationBell } from '@/components/NotificationBell';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getLinks = () => {
    if (!user) return [];
    
    const baseLinks = [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ];

    if (user.role === 'EMPLOYEE') {
      return [
        ...baseLinks,
        { name: 'Apply Leave', href: '/dashboard/apply', icon: Calendar },
        { name: 'My History', href: '/dashboard/history', icon: FileText },
      ];
    } else if (user.role === 'MANAGER') {
      return [
        ...baseLinks,
        { name: 'Team Requests', href: '/dashboard/team', icon: Users },
        { name: 'Apply Leave', href: '/dashboard/apply', icon: Calendar },
        { name: 'My History', href: '/dashboard/history', icon: FileText },
      ];
    } else if (user.role === 'ADMIN') {
      return [
        ...baseLinks,
        { name: 'Users', href: '/dashboard/users', icon: Users },
        { name: 'Leave Types', href: '/dashboard/leave-types', icon: Settings },
        { name: 'All Requests', href: '/dashboard/all-requests', icon: FileText },
        { name: 'Reports', href: '/dashboard/reports', icon: BarChart },
      ];
    }
    return baseLinks;
  };

  const links = getLinks();

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-background">
        
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-16 shrink-0 items-center px-6 border-b">
            <Calendar className="h-6 w-6 text-primary mr-2" />
            <span className="font-semibold text-lg tracking-tight">LeaveSync</span>
            <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate w-32">{user?.firstName} {user?.lastName}</span>
                <span className="text-xs text-muted-foreground capitalize">{user?.role.toLowerCase()}</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-16 shrink-0 border-b bg-card flex items-center justify-between px-6 lg:px-8">
            <button 
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-4 ml-auto">
              <NotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline-block">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-muted/30">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
