import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from './errorHandler';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw { statusCode: 401, message: 'Not authorized to access this route, no token provided' };
    }

    const decoded = verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true, departmentId: true, managerId: true, firstName: true, lastName: true }
    });

    if (!user) {
      throw { statusCode: 401, message: 'The user belonging to this token does no longer exist' };
    }
    
    if (!user.isActive) {
      throw { statusCode: 403, message: 'User account is deactivated' };
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next({
        statusCode: 403,
        message: 'User role is not authorized to access this route'
      });
    }
    next();
  };
};
