import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Factory that returns a middleware checking req.user.role.
 * Usage: router.get('/admin-only', authenticate, authorize(['Admin']), handler)
 */
export function authorize(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      next(new ForbiddenError('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}
