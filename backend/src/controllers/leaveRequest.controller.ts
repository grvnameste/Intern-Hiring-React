import { Request, Response, NextFunction } from 'express';
import { PrismaClient, LeaveStatus } from '@prisma/client';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger';
import { notificationService } from '../utils/notification.service';

const prisma = new PrismaClient();

const applyLeaveSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(5),
  attachmentUrl: z.string().optional(),
});

const processLeaveSchema = z.object({
  status: z.enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
  managerComment: z.string().optional(),
});

// Helper to calculate days between dates (excluding weekends)
const calculateLeaveDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  let curDate = new Date(startDate);
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

export const getLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, userId } = req.query;

    const where: any = {};
    
    // Admins see all by default, unless filtered
    // Managers see requests from their subordinates
    // Employees see only their own
    if (req.user.role === 'EMPLOYEE') {
      where.userId = req.user.id;
    } else if (req.user.role === 'MANAGER') {
      if (userId) {
        where.userId = userId;
      } else {
        // Find subordinates
        const subordinates = await prisma.user.findMany({ where: { managerId: req.user.id }, select: { id: true } });
        where.userId = { in: subordinates.map(s => s.id) };
      }
    } else if (req.user.role === 'ADMIN' && userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

export const applyLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = applyLeaveSchema.parse(req.body);
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const currentYear = start.getFullYear();

    if (start > end) {
      res.status(400).json({ success: false, message: 'Start date must be before end date' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateMidnight = new Date(start);
    startDateMidnight.setHours(0, 0, 0, 0);
    
    if (startDateMidnight < today) {
      res.status(400).json({ success: false, message: 'Start date cannot be in the past' });
      return;
    }

    const requestedDays = calculateLeaveDays(start, end);
    if (requestedDays <= 0) {
      res.status(400).json({ success: false, message: 'Invalid date range or only weekends selected' });
      return;
    }

    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId: req.user.id,
        status: { notIn: ['REJECTED', 'CANCELLED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      }
    });

    if (overlappingRequest) {
      if (
        overlappingRequest.startDate.getTime() === start.getTime() &&
        overlappingRequest.endDate.getTime() === end.getTime() &&
        overlappingRequest.leaveTypeId === data.leaveTypeId &&
        overlappingRequest.status === 'PENDING'
      ) {
        res.status(400).json({ success: false, message: 'You already have a request for these dates.' });
        return;
      }
      res.status(400).json({ success: false, message: 'This leave overlaps with an existing request.' });
      return;
    }



    const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
    if (!leaveType) {
      res.status(404).json({ success: false, message: 'Leave type not found' });
      return;
    }

    if (leaveType.requiresAttachment && !data.attachmentUrl) {
      res.status(400).json({ success: false, message: 'Medical certificate is required for this leave type.' });
      return;
    }

    if (data.attachmentUrl) {
      const isAllowed = data.attachmentUrl.startsWith('data:image/jpeg') || 
                        data.attachmentUrl.startsWith('data:image/png') ||
                        data.attachmentUrl.startsWith('data:image/jpg') ||
                        data.attachmentUrl.startsWith('data:application/pdf');
      if (!isAllowed) {
        res.status(400).json({ success: false, message: 'Invalid file type. Only PDF, PNG, and JPG are allowed.' });
        return;
      }
    }

    // Check balance
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: req.user.id,
          leaveTypeId: data.leaveTypeId,
          year: currentYear
        }
      }
    });

    if (!balance) {
      balance = await prisma.leaveBalance.create({
        data: {
          userId: req.user.id,
          leaveTypeId: data.leaveTypeId,
          year: currentYear,
          totalDays: leaveType.defaultDays,
          usedDays: 0
        }
      });
    }

    if (balance.totalDays - balance.usedDays < requestedDays) {
      res.status(400).json({ success: false, message: 'Insufficient leave balance' });
      return;
    }

    // Create request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: req.user.id,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl,
        managerId: req.user.managerId, // Automatically assigned to user's manager
      }
    });

    logAudit('LEAVE_APPLICATION', req.user.id, {
      leaveId: leaveRequest.id,
      leaveTypeId: data.leaveTypeId,
      startDate: start,
      endDate: end
    });

    if (req.user.managerId) {
      notificationService.createNotification(
        req.user.managerId,
        'New Leave Request',
        `${req.user.firstName} ${req.user.lastName} submitted a ${leaveType.name} leave request from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
        'LEAVE_REQUEST',
        leaveRequest.id
      );
    }

    res.status(201).json({ success: true, data: leaveRequest });
  } catch (error) {
    next(error);
  }
};

export const processLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, managerComment } = processLeaveSchema.parse(req.body);
    const id = req.params.id as string;

    const result = await prisma.$transaction(async (tx) => {
      const leaveRequest = await tx.leaveRequest.findUnique({ 
        where: { id },
        include: { leaveType: true }
      });
      
      if (!leaveRequest) {
        throw new Error('NOT_FOUND');
      }

      if (leaveRequest.status !== 'PENDING') {
        throw new Error('ALREADY_PROCESSED');
      }

      if (req.user.role !== 'ADMIN' && req.user.id !== leaveRequest.managerId) {
        throw new Error('UNAUTHORIZED');
      }

      if (status === 'APPROVED') {
        const requestedDays = calculateLeaveDays(leaveRequest.startDate, leaveRequest.endDate);
        const currentYear = leaveRequest.startDate.getFullYear();

        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: leaveRequest.userId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year: currentYear
            }
          }
        });

        if (!balance || (balance.totalDays - balance.usedDays < requestedDays)) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: balance.usedDays + requestedDays }
        });
      }

      await tx.leaveRequest.update({
        where: { id },
        data: { status, managerComment, managerId: req.user.id }
      });
      
      const action = status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED';
      await tx.auditLog.create({
        data: {
          action,
          userId: req.user.id,
          details: { leaveId: id, employeeId: leaveRequest.userId, status }
        }
      });
      
      return leaveRequest;
    });

    notificationService.createNotification(
      result.userId,
      `Leave Request ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
      `Your ${result.leaveType?.name || 'leave'} leave request from ${new Date(result.startDate).toLocaleDateString()} to ${new Date(result.endDate).toLocaleDateString()} has been ${status.toLowerCase()}.`,
      `LEAVE_${status}`,
      result.id
    );

    res.status(200).json({ success: true, message: `Leave request ${status.toLowerCase()}` });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Leave request not found' });
    } else if (error.message === 'ALREADY_PROCESSED') {
      res.status(400).json({ success: false, message: 'Leave request is already processed' });
    } else if (error.message === 'UNAUTHORIZED') {
      res.status(403).json({ success: false, message: 'Not authorized to process this request' });
    } else if (error.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ success: false, message: 'Insufficient leave balance at time of approval' });
    } else {
      next(error);
    }
  }
};

export const getLeaveBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let targetUserId = req.user.id;
    if (req.user.role !== 'EMPLOYEE' && req.query.userId) {
      targetUserId = req.query.userId as string;
    }

    const currentYear = new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { userId: targetUserId, year: currentYear },
      include: { leaveType: { select: { name: true } } }
    });

    res.status(200).json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
};

export const getAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: id as string },
      select: { userId: true, attachmentUrl: true }
    });

    if (!leaveRequest || !leaveRequest.attachmentUrl) {
      res.status(404).json({ success: false, message: 'Attachment not found' });
      return;
    }

    if (req.user.role === 'EMPLOYEE' && leaveRequest.userId !== req.user.id) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    
    if (req.user.role === 'MANAGER') {
      const employee = await prisma.user.findUnique({ where: { id: leaveRequest.userId } });
      if (employee?.managerId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
    }

    const parts = leaveRequest.attachmentUrl.split(';base64,');
    if (parts.length !== 2) {
      res.status(500).json({ success: false, message: 'Invalid attachment format in database' });
      return;
    }
    
    const contentType = parts[0].split(':')[1];
    const b64Data = parts[1];
    const buffer = Buffer.from(b64Data, 'base64');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const cancelLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, message: 'Leave request not found' });
      return;
    }

    if (leaveRequest.userId !== req.user.id) {
      res.status(403).json({ success: false, message: 'Not authorized to cancel this request' });
      return;
    }

    if (leaveRequest.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Only pending requests can be cancelled' });
      return;
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    logAudit('LEAVE_CANCELLED', req.user.id, { leaveId: id });

    res.status(200).json({ success: true, message: 'Leave request cancelled successfully' });
  } catch (error) {
    next(error);
  }
};
