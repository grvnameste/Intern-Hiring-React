import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface AuthUser {
  userId: string;
  role: string;
}

// Extend Express Request so req.user is typed throughout the app
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    // Support both Bearer header and httpOnly cookie
    const authHeader = req.headers['authorization'];
    const headerToken =
      authHeader?.startsWith('Bearer ') === true
        ? authHeader.slice(7)
        : undefined;
    const cookieToken: unknown = (req.cookies as Record<string, unknown>)?.[
      'token'
    ];
    const token =
      headerToken ??
      (typeof cookieToken === 'string' ? cookieToken : undefined);

    if (!token) {
      throw new UnauthorizedError('Missing authentication token');
    }

    req.user = verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
