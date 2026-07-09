import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger';

const prisma = new PrismaClient();

const departmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  description: z.string().optional(),
});

export const getDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
};

export const getDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id as string }
    });
    
    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }
    
    res.status(200).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = departmentSchema.parse(req.body);
    
    const existing = await prisma.department.findUnique({ where: { name: data.name } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Department already exists' });
      return;
    }
    
    const department = await prisma.department.create({ data });
    
    logAudit('DEPARTMENT_CREATED', req.user.id, { departmentId: department.id, name: department.name });
    
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = departmentSchema.parse(req.body);
    
    const department = await prisma.department.update({
      where: { id: req.params.id as string },
      data
    });
    
    logAudit('DEPARTMENT_UPDATED', req.user.id, { departmentId: department.id, updates: data });
    
    res.status(200).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Check if any users are assigned to this department
    const usersCount = await prisma.user.count({ where: { departmentId: id } });
    if (usersCount > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete a department currently assigned to users.' });
      return;
    }
    
    await prisma.department.delete({ where: { id } });
    
    logAudit('DEPARTMENT_DELETED', req.user.id, { departmentId: id });
    
    res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
};
