import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveStatus, Role } from "@prisma/client";
import { createApp } from "../src/app";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  leaveType: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  leaveBalance: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
  },
  leaveRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../src/config/prisma", () => ({ prisma: prismaMock }));

process.env.JWT_SECRET = "test-secret";

const app = createApp();

const tokenFor = (role: Role, id = `${role.toLowerCase()}-1`) =>
  jwt.sign({ id, role, email: `${id}@example.com` }, process.env.JWT_SECRET!);

const hashedPassword = async () => bcrypt.hash("Demo@123", 10);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock));
});

describe("auth", () => {
  it("logs in with valid credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Employee User",
      email: "employee@example.com",
      password: await hashedPassword(),
      role: Role.EMPLOYEE,
      department: "Engineering",
      managerId: "manager-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "employee@example.com",
      password: "Demo@123",
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.password).toBeUndefined();
  });

  it("rejects invalid login credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "employee@example.com",
      password: await hashedPassword(),
      role: Role.EMPLOYEE,
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "employee@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
  });
});

describe("auth middleware and role checks", () => {
  it("requires authentication for protected routes", async () => {
    const response = await request(app).get("/api/users/me");
    expect(response.status).toBe(401);
  });

  it("blocks non-admin users from admin user management", async () => {
    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${tokenFor(Role.EMPLOYEE)}`);

    expect(response.status).toBe(403);
  });
});

describe("users", () => {
  it("validates user creation input", async () => {
    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${tokenFor(Role.ADMIN)}`)
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
  });

  it("creates users with initial leave balances", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "employee-2",
      name: "New Employee",
      email: "new@example.com",
      password: "hashed",
      role: Role.EMPLOYEE,
      department: "Engineering",
      managerId: "manager-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.leaveType.findMany.mockResolvedValue([
      { id: "annual", name: "Annual Leave", maxDays: 18 },
    ]);
    prismaMock.leaveBalance.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${tokenFor(Role.ADMIN)}`)
      .send({
        name: "New Employee",
        email: "new@example.com",
        password: "Demo@123",
        role: Role.EMPLOYEE,
        department: "Engineering",
      });

    expect(response.status).toBe(201);
    expect(prismaMock.leaveBalance.createMany).toHaveBeenCalledOnce();
    expect(response.body.password).toBeUndefined();
  });
});

describe("leave requests", () => {
  it("creates leave requests when balance is sufficient", async () => {
    prismaMock.leaveBalance.findUnique.mockResolvedValue({ balance: 5 });
    prismaMock.leaveRequest.create.mockResolvedValue({
      id: "leave-1",
      userId: "employee-1",
      leaveTypeId: "annual",
      startDate: new Date("2026-07-20"),
      endDate: new Date("2026-07-21"),
      status: LeaveStatus.PENDING,
      reason: "Family event",
    });

    const response = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${tokenFor(Role.EMPLOYEE, "employee-1")}`)
      .send({
        leaveTypeId: "annual",
        startDate: "2026-07-20",
        endDate: "2026-07-21",
        reason: "Family event",
      });

    expect(response.status).toBe(201);
  });

  it("rejects invalid leave date ranges", async () => {
    const response = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${tokenFor(Role.EMPLOYEE, "employee-1")}`)
      .send({
        leaveTypeId: "annual",
        startDate: "2026-07-22",
        endDate: "2026-07-20",
        reason: "Family event",
      });

    expect(response.status).toBe(400);
  });

  it("approves direct team requests and deducts balance once", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "leave-1",
      userId: "employee-1",
      leaveTypeId: "annual",
      startDate: new Date("2026-07-20"),
      endDate: new Date("2026-07-21"),
      status: LeaveStatus.PENDING,
      user: { id: "employee-1", managerId: "manager-1" },
      leaveType: { id: "annual" },
    });
    prismaMock.leaveBalance.findUnique.mockResolvedValue({ balance: 5 });
    prismaMock.leaveBalance.update.mockResolvedValue({ balance: 3 });
    prismaMock.leaveRequest.update.mockResolvedValue({
      id: "leave-1",
      status: LeaveStatus.APPROVED,
    });

    const response = await request(app)
      .put("/api/leave-requests/leave-1")
      .set("Authorization", `Bearer ${tokenFor(Role.MANAGER, "manager-1")}`)
      .send({ status: LeaveStatus.APPROVED });

    expect(response.status).toBe(200);
    expect(prismaMock.leaveBalance.update).toHaveBeenCalledOnce();
  });

  it("rejects direct team requests without deducting balance", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "leave-1",
      userId: "employee-1",
      leaveTypeId: "annual",
      startDate: new Date("2026-07-20"),
      endDate: new Date("2026-07-21"),
      status: LeaveStatus.PENDING,
      user: { id: "employee-1", managerId: "manager-1" },
      leaveType: { id: "annual" },
    });
    prismaMock.leaveRequest.update.mockResolvedValue({
      id: "leave-1",
      status: LeaveStatus.REJECTED,
    });

    const response = await request(app)
      .put("/api/leave-requests/leave-1")
      .set("Authorization", `Bearer ${tokenFor(Role.MANAGER, "manager-1")}`)
      .send({ status: LeaveStatus.REJECTED });

    expect(response.status).toBe(200);
    expect(prismaMock.leaveBalance.update).not.toHaveBeenCalled();
  });

  it("blocks managers from updating non-team requests", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "leave-1",
      status: LeaveStatus.PENDING,
      userId: "employee-1",
      user: { id: "employee-1", managerId: "other-manager" },
      leaveType: { id: "annual" },
    });

    const response = await request(app)
      .put("/api/leave-requests/leave-1")
      .set("Authorization", `Bearer ${tokenFor(Role.MANAGER, "manager-1")}`)
      .send({ status: LeaveStatus.APPROVED });

    expect(response.status).toBe(403);
  });
});
