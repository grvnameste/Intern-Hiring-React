import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


function calculateDays(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

// ── Create Leave Request (Employee / Manager applying for themselves) ──────────
export async function createLeaveRequest(params: {
  userId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
}) {
  const { userId, leaveTypeId, startDate, endDate, reason } = params;

  // Validate dates
  if (endDate < startDate) {
    throw new BadRequestError('End date must be on or after start date');
  }

  const days = calculateDays(startDate, endDate);

  // Pre-check balance (soft guard — the transactional approval is the hard guard)
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
  });

  if (!balance) {
    throw new BadRequestError('No leave balance found for this leave type');
  }

  if (balance.balance < days) {
    throw new BadRequestError(
      `Insufficient leave balance. Requested: ${days} day(s), available: ${balance.balance}`,
    );
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
      status: 'Pending',
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: true,
    },
  });

  return request;
}

// ── Get Leave Requests (role-scoped) ──────────────────────────────────────────
export async function getLeaveRequests(params: {
  requestingUserId: string;
  requestingUserRole: string;
  filters?: {
    status?: string;
    from?: string;
    to?: string;
    department?: string;
  };
}) {
  const { requestingUserId, requestingUserRole, filters } = params;

  // Build role-scoped where clause
  type WhereClause = {
    userId?: string;
    user?: { managerId?: string; department?: string };
    status?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
    startDate?: { gte?: Date };
    endDate?: { lte?: Date };
  };

  const where: WhereClause = {};

  if (requestingUserRole === 'Employee') {
    // Employees see only their own requests
    where.userId = requestingUserId;
  } else if (requestingUserRole === 'Manager') {
    // Managers see requests from their direct reports
    where.user = { managerId: requestingUserId };
  }
  // Admin sees all — no userId constraint

  // Apply optional filters (Admin only in practice but harmless elsewhere)
  if (filters?.status) {
    where.status = filters.status as 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  }
  if (filters?.from) {
    where.startDate = { gte: new Date(filters.from) };
  }
  if (filters?.to) {
    where.endDate = { lte: new Date(filters.to) };
  }
  if (filters?.department && requestingUserRole === 'Admin') {
    where.user = { ...where.user, department: filters.department };
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      leaveType: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests;
}

// ── Approve Leave Request (Manager only — atomic balance decrement) ───────────
export async function approveLeaveRequest(requestId: string, approverId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { managerId: true } } },
    });

    if (!request) {
      throw new NotFoundError('Leave request not found');
    }

    // Ensure the approver manages this employee
    if (request.user.managerId !== approverId) {
      throw new ForbiddenError('You can only approve requests for your direct reports');
    }

    if (request.status !== 'Pending') {
      throw new ConflictError(`Cannot approve a request with status '${request.status}'`);
    }

    const days = calculateDays(request.startDate, request.endDate);

    // Atomic decrement guarded by balance check in the WHERE clause.
    // If balance < days, updateMany matches 0 rows — detected below.
    // This is race-free: the check and the write are the same DB operation.
    const updated = await tx.leaveBalance.updateMany({
      where: {
        userId: request.userId,
        leaveTypeId: request.leaveTypeId,
        balance: { gte: days },
      },
      data: { balance: { decrement: days } },
    });

    if (updated.count === 0) {
      throw new ConflictError('Insufficient leave balance');
    }

    return tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'Approved', approvedById: approverId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        leaveType: true,
        approvedBy: { select: { id: true, name: true } },
      },
    });
  });
}

// ── Reject Leave Request (Manager only — no balance change) ───────────────────
export async function rejectLeaveRequest(
  requestId: string,
  approverId: string,
  comment?: string,
) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { managerId: true } } },
  });

  if (!request) {
    throw new NotFoundError('Leave request not found');
  }

  if (request.user.managerId !== approverId) {
    throw new ForbiddenError('You can only reject requests for your direct reports');
  }

  if (request.status !== 'Pending') {
    throw new ConflictError(`Cannot reject a request with status '${request.status}'`);
  }

  // Rejection performs NO balance mutation
  return prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: 'Rejected',
      approvedById: approverId,
      ...(comment !== undefined && { comment }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });
}

// ── Cancel Leave Request (Employee — own requests, only if Pending) ────────────
export async function cancelLeaveRequest(requestId: string, requestingUserId: string) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new NotFoundError('Leave request not found');
  }

  if (request.userId !== requestingUserId) {
    throw new ForbiddenError('You can only cancel your own leave requests');
  }

  if (request.status !== 'Pending') {
    throw new ConflictError(`Cannot cancel a request with status '${request.status}'`);
  }

  return prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: 'Cancelled' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: true,
    },
  });
}
