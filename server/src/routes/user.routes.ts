import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, authorize, type AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler, HttpError, toPublicUser, validate } from "../utils/http";

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
  department: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
});

router.get(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { manager: { select: { id: true, name: true, email: true } } },
    });

    res.json(users.map(toPublicUser));
  }),
);

router.post(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = validate(createUserSchema, req.body);
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      throw new HttpError(409, "Email is already registered");
    }

    if (body.managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: body.managerId },
      });
      if (!manager || manager.role !== Role.MANAGER) {
        throw new HttpError(400, "managerId must reference a manager");
      }
    }

    const password = await bcrypt.hash(body.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: body.name,
          email: body.email,
          password,
          role: body.role,
          department: body.department ?? null,
          managerId: body.managerId ?? null,
        },
      });

      const leaveTypes = await tx.leaveType.findMany();
      if (leaveTypes.length > 0) {
        await tx.leaveBalance.createMany({
          data: leaveTypes.map((leaveType) => ({
            userId: createdUser.id,
            leaveTypeId: leaveType.id,
            balance: leaveType.maxDays,
          })),
          skipDuplicates: true,
        });
      }

      return createdUser;
    });

    res.status(201).json(toPublicUser(user));
  }),
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        leaveBalances: { include: { leaveType: true } },
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.json(toPublicUser(user));
  }),
);

export default router;
