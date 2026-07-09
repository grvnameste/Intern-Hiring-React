import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger';

const prisma = new PrismaClient();

const leaveTypeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  defaultDays: z.number().int().min(0),
  requiresAttachment: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateLeaveTypeSchema = leaveTypeSchema.partial();

export const getLeaveTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leaveTypes = await prisma.leaveType.findMany();
    res.status(200).json({ success: true, data: leaveTypes });
  } catch (error) {
    next(error);
  }
};

export const getLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: req.params.id as string },
    });

    if (!leaveType) {
      res.status(404).json({ success: false, message: 'Leave type not found' });
      return;
    }

    res.status(200).json({ success: true, data: leaveType });
  } catch (error) {
    next(error);
  }
};

export const createLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = leaveTypeSchema.parse(req.body);

    const leaveType = await prisma.leaveType.create({
      data,
    });

    logAudit('LEAVE_TYPE_CREATED', req.user.id, { leaveTypeId: leaveType.id, name: leaveType.name });

    res.status(201).json({ success: true, data: leaveType });
  } catch (error) {
    next(error);
  }
};

export const updateLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateLeaveTypeSchema.parse(req.body);

    const leaveType = await prisma.$transaction(async (tx) => {
      const lt = await tx.leaveType.update({
        where: { id: req.params.id as string },
        data,
      });

      if (data.defaultDays !== undefined) {
        const currentYear = new Date().getFullYear();
        await tx.leaveBalance.updateMany({
          where: { leaveTypeId: lt.id, year: currentYear },
          data: { totalDays: data.defaultDays },
        });
        logAudit('POLICY_UPDATED', req.user.id, { leaveTypeId: lt.id, defaultDays: data.defaultDays });
      }

      return lt;
    });

    logAudit('LEAVE_TYPE_UPDATED', req.user.id, { leaveTypeId: leaveType.id, updates: data });

    res.status(200).json({ success: true, data: leaveType });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      res.status(404).json({ success: false, message: 'Leave type not found' });
      return;
    }
    next(error);
  }
};

export const deleteLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.leaveType.delete({
      where: { id: req.params.id as string },
    });
    
    logAudit('LEAVE_TYPE_DELETED', req.user.id, { leaveTypeId: req.params.id });
    
    res.status(200).json({ success: true, message: 'Leave type deleted' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      res.status(404).json({ success: false, message: 'Leave type not found' });
      return;
    }
    next(error);
  }
};
