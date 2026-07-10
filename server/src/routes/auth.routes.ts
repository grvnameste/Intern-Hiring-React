import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, signToken, type AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler, HttpError, toPublicUser, validate } from "../utils/http";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = validate(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.password);
    if (!isPasswordValid) {
      throw new HttpError(401, "Invalid email or password");
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    res.json({ token, user: toPublicUser(user) });
  }),
);

router.post("/logout", (_req, res) => {
  res.status(204).send();
});

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.id },
      include: {
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
