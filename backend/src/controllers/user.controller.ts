import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger';

const prisma = new PrismaClient();

const createUserSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role).optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
}).superRefine((data, ctx) => {
  if ((data.role === 'EMPLOYEE' || data.role === 'MANAGER') && !data.departmentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Department is required for Employees and Managers',
      path: ['departmentId'],
    });
  }
});

const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});
// For updates, the controller logic will handle checking the existing role and department if they are not provided in the payload.

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        department: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      }
    });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        managerId: true,
        department: { select: { name: true } },
      }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createUserSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already in use' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        role: data.role || Role.EMPLOYEE,
        departmentId: data.departmentId,
        managerId: data.managerId,
      },
    });

    logAudit('USER_CREATED', req.user.id, { createdUserId: user.id, email: user.email, role: user.role });

    res.status(201).json({ success: true, data: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data,
    });

    logAudit('USER_UPDATED', req.user.id, { updatedUserId: user.id, updates: data });

    res.status(200).json({ success: true, data: { id: user.id, email: user.email } });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id as string },
    });
    
    logAudit('USER_DELETED', req.user.id, { deletedUserId: req.params.id });
    
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    next(error);
  }
};
