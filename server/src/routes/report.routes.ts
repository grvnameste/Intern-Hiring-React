import { Router } from "express";
import { LeaveStatus, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, leaveDays } from "../utils/http";

const router = Router();

router.get(
  "/leave-summary",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const approvedRequests = await prisma.leaveRequest.findMany({
      where: { status: LeaveStatus.APPROVED },
      include: {
        user: { select: { id: true, name: true, department: true } },
        leaveType: true,
      },
    });

    const summary = approvedRequests.reduce<
      Record<string, { leaveType: string; requests: number; days: number }>
    >((acc, request) => {
      const key = request.leaveType.name;
      acc[key] ??= { leaveType: key, requests: 0, days: 0 };
      acc[key].requests += 1;
      acc[key].days += leaveDays(request.startDate, request.endDate);
      return acc;
    }, {});

    res.json({
      totalApprovedRequests: approvedRequests.length,
      byLeaveType: Object.values(summary),
      requests: approvedRequests,
    });
  }),
);

router.get(
  "/leave-balance",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const balances = await prisma.leaveBalance.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        leaveType: true,
      },
      orderBy: [{ user: { name: "asc" } }, { leaveType: { name: "asc" } }],
    });

    res.json(balances);
  }),
);

export default router;
