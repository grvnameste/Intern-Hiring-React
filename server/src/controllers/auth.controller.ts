import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import {
  hashPassword,
  signToken,
  verifyPassword,
} from '../services/auth.service.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Email and password are required');
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = signToken({ userId: user.id, role: user.role });

    // Set httpOnly cookie (convenient for browser) AND return token in body (convenient for API clients)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
}
