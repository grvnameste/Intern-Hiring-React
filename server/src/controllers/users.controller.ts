import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../services/auth.service.js';
import {
  BadRequestError,
  NotFoundError,
} from '../utils/errors.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['Employee', 'Manager', 'Admin']),
  managerId: z.string().uuid().nullable().optional(),
  department: z.string().optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['Employee', 'Manager', 'Admin']).optional(),
  managerId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  department: z.string().optional(),
});

// POST /api/users — Admin only
export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { name, email, password, role, managerId, department } = parsed.data;

    const hashedPassword = await hashPassword(password);

    // Wrap user creation + balance initialisation in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          ...(managerId !== undefined && { managerId }),
          ...(department !== undefined && { department }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerId: true,
          department: true,
          active: true,
          createdAt: true,
        },
      });

      // Initialise a LeaveBalance row for every existing LeaveType
      const leaveTypes = await tx.leaveType.findMany();
      if (leaveTypes.length > 0) {
        await tx.leaveBalance.createMany({
          data: leaveTypes.map((lt) => ({
            userId: created.id,
            leaveTypeId: lt.id,
            balance: lt.maxDays,
          })),
        });
      }

      return created;
    });

    res.status(201).json(user);
  } catch (err: unknown) {
    // Catch Prisma unique constraint violation on email
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      next(new BadRequestError('Email already in use'));
      return;
    }
    next(err);
  }
}

// GET /api/users — Admin only, paginated + filtered
export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
    const managerId =
      typeof req.query['managerId'] === 'string' ? req.query['managerId'] : undefined;
    const page = parseInt(
      typeof req.query['page'] === 'string' ? req.query['page'] : '1',
      10,
    );
    const limit = parseInt(
      typeof req.query['limit'] === 'string' ? req.query['limit'] : '20',
      10,
    );
    const skip = (page - 1) * limit;

    const where = {
      ...(role !== undefined && { role: role as 'Employee' | 'Manager' | 'Admin' }),
      ...(managerId !== undefined && { managerId }),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerId: true,
          department: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/me — any authenticated role
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new NotFoundError('User not found');
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        department: true,
        active: true,
        createdAt: true,
        leaveBalances: {
          include: { leaveType: true },
        },
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id — Admin only
export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const data = parsed.data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.role !== undefined && { role: data.role }),
        ...(data.managerId !== undefined && { managerId: data.managerId }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.department !== undefined && { department: data.department }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        department: true,
        active: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2025'
    ) {
      next(new NotFoundError('User not found'));
      return;
    }
    next(err);
  }
}
