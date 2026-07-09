import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit } from '../utils/auditLogger';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [userGroup, leaveRequestGroup, totalLeaveTypes] = await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        where: { isActive: true }
      }),
      prisma.leaveRequest.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.leaveType.count({ where: { isActive: true } })
    ]);

    const totalEmployees = userGroup.find(u => u.role === 'EMPLOYEE')?._count.id || 0;
    const totalManagers = userGroup.find(u => u.role === 'MANAGER')?._count.id || 0;
    const totalAdmins = userGroup.find(u => u.role === 'ADMIN')?._count.id || 0;
    const totalUsers = totalEmployees + totalManagers + totalAdmins;

    const pendingRequests = leaveRequestGroup.find(r => r.status === 'PENDING')?._count.id || 0;
    const approvedRequests = leaveRequestGroup.find(r => r.status === 'APPROVED')?._count.id || 0;
    const rejectedRequests = leaveRequestGroup.find(r => r.status === 'REJECTED')?._count.id || 0;
    const cancelledRequests = leaveRequestGroup.find(r => r.status === 'CANCELLED')?._count.id || 0;
    const totalLeaveRequests = pendingRequests + approvedRequests + rejectedRequests + cancelledRequests;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalEmployees,
        totalManagers,
        totalAdmins,
        totalLeaveRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        totalLeaveTypes,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaveTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Basic aggregation: Leave requests per month
    const requests = await prisma.leaveRequest.findMany({
      where: { status: 'APPROVED' },
      select: { startDate: true }
    });

    const monthlyTrends = Array(12).fill(0);
    requests.forEach(req => {
      const month = req.startDate.getMonth();
      monthlyTrends[month]++;
    });

    res.status(200).json({ success: true, data: monthlyTrends });
  } catch (error) {
    next(error);
  }
};

export const getAllBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentYear = new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { year: currentYear },
      include: { 
        user: { 
          select: { 
            firstName: true, 
            lastName: true, 
            email: true, 
            role: true,
            department: { select: { name: true } }
          } 
        },
        leaveType: { select: { name: true } } 
      },
      orderBy: [
        { user: { firstName: 'asc' } },
        { leaveType: { name: 'asc' } }
      ]
    });

    logAudit('REPORT_VIEWED', req.user.id, { report: 'BALANCES' });
    res.status(200).json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
};

export const getLeaveSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summary = await prisma.leaveRequest.groupBy({
      by: ['leaveTypeId', 'userId', 'status'],
      _count: {
        id: true,
      },
    });
    
    const users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } });
    const leaveTypes = await prisma.leaveType.findMany({ select: { id: true, name: true } });

    const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
    const typeMap = new Map(leaveTypes.map(t => [t.id, t.name]));

    const formattedSummary = summary.map(item => ({
      employeeName: userMap.get(item.userId) || 'Unknown',
      leaveTypeName: typeMap.get(item.leaveTypeId) || 'Unknown',
      status: item.status,
      totalRequests: item._count.id
    }));

    logAudit('REPORT_VIEWED', req.user.id, { report: 'SUMMARY' });
    res.status(200).json({ success: true, data: formattedSummary });
  } catch (error) {
    next(error);
  }
};

export const getLeaveCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requests = await prisma.leaveRequest.findMany({
      where: { status: 'APPROVED' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        leaveType: { select: { name: true } }
      },
      orderBy: { startDate: 'asc' }
    });
    
    logAudit('REPORT_VIEWED', req.user.id, { report: 'CALENDAR' });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

export const logReportExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type } = req.body;
    logAudit('REPORT_EXPORTED', req.user.id, { report: type });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
