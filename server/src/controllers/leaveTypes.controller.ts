import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { BadRequestError } from '../utils/errors.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const createLeaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  maxDays: z.number().int().positive('maxDays must be a positive integer'),
});

// GET /api/leave-types — any authenticated role
export async function getLeaveTypes(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(leaveTypes);
  } catch (err) {
    next(err);
  }
}

// POST /api/leave-types — Admin only
export async function createLeaveType(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createLeaveTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { name, maxDays } = parsed.data;

    const leaveType = await prisma.leaveType.create({
      data: { name, maxDays },
    });

    res.status(201).json(leaveType);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      next(new BadRequestError('A leave type with that name already exists'));
      return;
    }
    next(err);
  }
}
