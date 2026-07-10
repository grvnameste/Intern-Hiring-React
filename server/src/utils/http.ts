import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const validate = <T>(schema: ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, error.issues[0]?.message ?? "Invalid input");
    }
    throw error;
  }
};

export const toPublicUser = <T extends { password?: string }>(user: T) => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

export const leaveDays = (startDate: Date, endDate: Date) => {
  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  return Math.floor((end - start) / 86_400_000) + 1;
};
