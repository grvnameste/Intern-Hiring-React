import { Router } from "express";
import { LeaveStatus, Role, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, authorize, type AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler, HttpError, leaveDays, validate } from "../utils/http";

const router = Router();

const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(5),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
  });

const updateLeaveRequestSchema = z.object({
  status: z.nativeEnum(LeaveStatus),
});

const includeLeaveDetails = {
  user: { select: { id: true, name: true, email: true, department: true, managerId: true } },
  leaveType: true,
} satisfies Prisma.LeaveRequestInclude;

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const currentUser = authReq.user!;

    const where =
      currentUser.role === Role.EMPLOYEE
        ? { userId: currentUser.id }
        : currentUser.role === Role.MANAGER
          ? { user: { managerId: currentUser.id } }
          : {};

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: includeLeaveDetails,
      orderBy: { createdAt: "desc" },
    });

    res.json(leaveRequests);
  }),
);

router.post(
  "/",
  authenticate,
  authorize(Role.EMPLOYEE),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const body = validate(createLeaveRequestSchema, req.body);
    const requestedDays = leaveDays(body.startDate, body.endDate);

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId: {
          userId: authReq.user!.id,
          leaveTypeId: body.leaveTypeId,
        },
      },
    });

    if (!balance) {
      throw new HttpError(400, "Leave balance is not configured");
    }

    if (balance.balance < requestedDays) {
      throw new HttpError(400, "Leave request exceeds available balance");
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: authReq.user!.id,
        leaveTypeId: body.leaveTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
      },
      include: includeLeaveDetails,
    });

    res.status(201).json(leaveRequest);
  }),
);

router.put(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const body = validate(updateLeaveRequestSchema, req.body);
    const currentUser = authReq.user!;
    const requestId = String(req.params.id);

    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { user: true, leaveType: true },
    });

    if (!existingRequest) {
      throw new HttpError(404, "Leave request not found");
    }

    if (currentUser.role === Role.EMPLOYEE) {
      if (
        existingRequest.userId !== currentUser.id ||
        existingRequest.status !== LeaveStatus.PENDING ||
        body.status !== LeaveStatus.CANCELLED
      ) {
        throw new HttpError(403, "Employees can only cancel their own pending requests");
      }

      const cancelledRequest = await prisma.leaveRequest.update({
        where: { id: existingRequest.id },
        data: { status: LeaveStatus.CANCELLED },
        include: includeLeaveDetails,
      });
      res.json(cancelledRequest);
      return;
    }

    if (currentUser.role !== Role.MANAGER) {
      throw new HttpError(403, "Only managers can update leave decisions");
    }

    if (existingRequest.user.managerId !== currentUser.id) {
      throw new HttpError(403, "Managers can only update direct team requests");
    }

    const managerStatus =
      body.status === LeaveStatus.APPROVED || body.status === LeaveStatus.REJECTED
        ? body.status
        : null;

    if (!managerStatus) {
      throw new HttpError(400, "Managers can only approve or reject requests");
    }

    if (existingRequest.status !== LeaveStatus.PENDING) {
      throw new HttpError(400, "Only pending requests can be updated");
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      if (managerStatus === LeaveStatus.APPROVED) {
        const requestedDays = leaveDays(
          existingRequest.startDate,
          existingRequest.endDate,
        );
        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId: {
              userId: existingRequest.userId,
              leaveTypeId: existingRequest.leaveTypeId,
            },
          },
        });

        if (!balance || balance.balance < requestedDays) {
          throw new HttpError(400, "Insufficient balance to approve request");
        }

        await tx.leaveBalance.update({
          where: {
            userId_leaveTypeId: {
              userId: existingRequest.userId,
              leaveTypeId: existingRequest.leaveTypeId,
            },
          },
          data: { balance: { decrement: requestedDays } },
        });
      }

      return tx.leaveRequest.update({
        where: { id: existingRequest.id },
        data: { status: managerStatus },
        include: includeLeaveDetails,
      });
    });

    res.json(updatedRequest);
  }),
);

export default router;
