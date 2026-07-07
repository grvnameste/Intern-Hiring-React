import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createLeaveRequest,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from '../services/leaveRequest.service.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';


const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid('Invalid leave type ID'),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid start date' }),
  endDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid end date' }),
  reason: z.string().min(1, 'Reason is required'),
});

const updateLeaveRequestSchema = z.object({
  status: z.enum(['Approved', 'Rejected', 'Cancelled']),
  comment: z.string().optional(),
});


export async function createLeaveRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId) {
      throw new ForbiddenError('Not authenticated');
    }

    if (role !== 'Employee' && role !== 'Manager') {
      throw new ForbiddenError('Only employees and managers can submit leave requests');
    }

    const parsed = createLeaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { leaveTypeId, startDate, endDate, reason } = parsed.data;

    const request = await createLeaveRequest({
      userId,
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    });

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

// GET /api/leave-requests — role-scoped
export async function getLeaveRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new ForbiddenError('Not authenticated');
    }

    const filters: {
      status?: string;
      from?: string;
      to?: string;
      department?: string;
    } = {};
    if (typeof req.query['status'] === 'string') filters.status = req.query['status'];
    if (typeof req.query['from'] === 'string') filters.from = req.query['from'];
    if (typeof req.query['to'] === 'string') filters.to = req.query['to'];
    if (typeof req.query['department'] === 'string') filters.department = req.query['department'];

    const requests = await getLeaveRequests({
      requestingUserId: userId,
      requestingUserRole: role,
      filters,
    });

    res.json(requests);
  } catch (err) {
    next(err);
  }
}

// PUT /api/leave-requests/:id — Manager (approve/reject) or Employee (cancel)
export async function updateLeaveRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new ForbiddenError('Not authenticated');
    }

    const { id } = req.params as { id: string };

    const parsed = updateLeaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { status, comment } = parsed.data;

    let updatedRequest;

    if (status === 'Approved') {
      if (role !== 'Manager' && role !== 'Admin') {
        throw new ForbiddenError('Only managers can approve leave requests');
      }
      updatedRequest = await approveLeaveRequest(id, userId);
    } else if (status === 'Rejected') {
      if (role !== 'Manager' && role !== 'Admin') {
        throw new ForbiddenError('Only managers can reject leave requests');
      }
      updatedRequest = await rejectLeaveRequest(id, userId, comment);
    } else if (status === 'Cancelled') {
      if (role !== 'Employee' && role !== 'Manager') {
        throw new ForbiddenError('Only the request owner can cancel a leave request');
      }
      updatedRequest = await cancelLeaveRequest(id, userId);
    } else {
      throw new BadRequestError('Invalid status transition');
    }

    res.json(updatedRequest);
  } catch (err) {
    next(err);
  }
}
