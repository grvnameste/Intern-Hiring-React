import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function calculateDays(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

export async function getLeaveSummary(params: {
  department?: string;
  from?: string;
  to?: string;
}) {
  const { department, from, to } = params;

  // Build where conditions
  const where: any = {
    status: 'Approved',
  };

  if (department) {
    where.user = {
      department: department,
    };
  }

  if (from || to) {
    where.startDate = {};
    if (from) {
      where.startDate.gte = new Date(from);
    }
    if (to) {
      where.endDate = where.endDate || {};
      where.endDate.lte = new Date(to);
    }
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          department: true,
        },
      },
      leaveType: {
        select: {
          name: true,
        },
      },
    },
  });

  const byType: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  const byEmployee: Record<string, number> = {};

  for (const req of requests) {
    const days = calculateDays(req.startDate, req.endDate);
    
    // Aggregate by leave type
    const typeName = req.leaveType.name;
    byType[typeName] = (byType[typeName] || 0) + days;

    // Aggregate by department
    const deptName = req.user.department || 'Unassigned';
    byDepartment[deptName] = (byDepartment[deptName] || 0) + days;

    // Aggregate by employee
    const empName = req.user.name;
    byEmployee[empName] = (byEmployee[empName] || 0) + days;
  }

  return {
    byType,
    byDepartment,
    byEmployee,
  };
}

export async function getLeaveBalanceReport() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      department: true,
      leaveBalances: {
        select: {
          balance: true,
          leaveType: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    department: u.department || 'Unassigned',
    balances: u.leaveBalances.map((lb) => ({
      leaveType: lb.leaveType.name,
      remaining: lb.balance,
    })),
  }));
}

export async function getLeaveCalendarReport(teamId?: string) {
  const where: any = {
    status: 'Approved',
  };

  if (teamId) {
    where.user = {
      managerId: teamId,
    };
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
        },
      },
      leaveType: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  return requests.map((req) => ({
    userId: req.userId,
    name: req.user.name,
    startDate: req.startDate.toISOString(),
    endDate: req.endDate.toISOString(),
    leaveType: req.leaveType.name,
  }));
}
