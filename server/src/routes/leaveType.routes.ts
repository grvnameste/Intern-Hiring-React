import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, HttpError, validate } from "../utils/http";

const router = Router();

const createLeaveTypeSchema = z.object({
  name: z.string().min(2),
  maxDays: z.coerce.number().int().positive(),
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (_req, res) => {
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: "asc" },
    });
    res.json(leaveTypes);
  }),
);

router.post(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = validate(createLeaveTypeSchema, req.body);
    const existing = await prisma.leaveType.findUnique({
      where: { name: body.name },
    });

    if (existing) {
      throw new HttpError(409, "Leave type already exists");
    }

    const leaveType = await prisma.$transaction(async (tx) => {
      const createdLeaveType = await tx.leaveType.create({
        data: { name: body.name, maxDays: body.maxDays },
      });
      const users = await tx.user.findMany({ select: { id: true } });
      if (users.length > 0) {
        await tx.leaveBalance.createMany({
          data: users.map((user) => ({
            userId: user.id,
            leaveTypeId: createdLeaveType.id,
            balance: body.maxDays,
          })),
          skipDuplicates: true,
        });
      }
      return createdLeaveType;
    });

    res.status(201).json(leaveType);
  }),
);

export default router;
