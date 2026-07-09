import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import app from '../src/app.js';
import { hashPassword } from '../src/services/auth.service.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

describe('Employee Leave Management System API Tests', () => {
  let adminToken = '';
  let managerToken = '';
  let employeeToken = '';
  let employeeId = '';
  let managerId = '';
  let leaveTypeId = '';
  let pendingRequestId = '';

  beforeAll(async () => {
    // Set up test users & leave types directly in the DB
    const pwd = await hashPassword('password123');

    // Create unique identifiers to avoid conflicts with seeds
    const suffix = Date.now();

    const admin = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: `admin-${suffix}@test.local`,
        password: pwd,
        role: 'Admin',
        department: 'HR',
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: 'Test Manager',
        email: `manager-${suffix}@test.local`,
        password: pwd,
        role: 'Manager',
        department: 'Engineering',
        managerId: admin.id,
      },
    });
    managerId = manager.id;

    const employee = await prisma.user.create({
      data: {
        name: 'Test Employee',
        email: `emp-${suffix}@test.local`,
        password: pwd,
        role: 'Employee',
        department: 'Engineering',
        managerId: manager.id,
      },
    });
    employeeId = employee.id;

    const leaveType = await prisma.leaveType.create({
      data: {
        name: `Vacation-${suffix}`,
        maxDays: 10,
      },
    });
    leaveTypeId = leaveType.id;

    // Give employee 5 days of balance
    await prisma.leaveBalance.create({
      data: {
        userId: employee.id,
        leaveTypeId: leaveType.id,
        balance: 5,
      },
    });

    // Login to get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'password123' });
    adminToken = adminLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: manager.email, password: 'password123' });
    managerToken = managerLogin.body.token;

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employee.email, password: 'password123' });
    employeeToken = employeeLogin.body.token;
  });

  afterAll(async () => {
    // Cleanup created data
    await prisma.leaveRequest.deleteMany({
      where: { userId: { in: [employeeId, managerId] } },
    });
    await prisma.leaveBalance.deleteMany({
      where: { userId: { in: [employeeId, managerId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [employeeId, managerId] } },
    });
    await prisma.leaveType.delete({
      where: { id: leaveTypeId },
    });
    await pool.end();
  });

  describe('Auth & Session', () => {
    it('should fail login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `emp-${Date.now()}@test.local`, password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return current user information', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Employee');
      expect(res.body.role).toBe('Employee');
      expect(res.body.leaveBalances).toHaveLength(1);
    });
  });

  describe('RBAC Middleware', () => {
    it('should reject employee accessing admin routes', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin accessing admin routes', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
    });
  });

  describe('Leave Request Creation & Validation', () => {
    it('should fail to create a leave request with invalid dates', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const res = await request(app)
        .post('/api/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId,
          startDate: today.toISOString(),
          endDate: yesterday.toISOString(),
          reason: 'Invalid dates',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('should reject a leave request that exceeds available balance', async () => {
      const today = new Date();
      const inTwoWeeks = new Date(today);
      inTwoWeeks.setDate(today.getDate() + 14);
      const inThreeWeeks = new Date(inTwoWeeks);
      inThreeWeeks.setDate(inTwoWeeks.getDate() + 8); // 9 days requested, only 5 available

      const res = await request(app)
        .post('/api/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId,
          startDate: inTwoWeeks.toISOString(),
          endDate: inThreeWeeks.toISOString(),
          reason: 'Too long',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Insufficient leave balance');
    });

    it('should successfully create a valid leave request', async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const endOfNextWeek = new Date(nextWeek);
      endOfNextWeek.setDate(nextWeek.getDate() + 2); // 3 days requested, 5 available

      const res = await request(app)
        .post('/api/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId,
          startDate: nextWeek.toISOString(),
          endDate: endOfNextWeek.toISOString(),
          reason: 'Need a break',
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('Pending');
      pendingRequestId = res.body.id;
    });
  });

  describe('Approval & Rejection Service', () => {
    it('should reject approval from a manager who does not manage the employee', async () => {
      // Admin tries to approve (only direct report's manager can approve)
      const res = await request(app)
        .put(`/api/leave-requests/${pendingRequestId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Approved' });
      expect(res.status).toBe(403);
    });

    it('should successfully approve a pending request and deduct balance', async () => {
      const res = await request(app)
        .put(`/api/leave-requests/${pendingRequestId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Approved' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Approved');

      // Verify the balance was deducted: 5 - 3 = 2
      const balance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId: { userId: employeeId, leaveTypeId } },
      });
      expect(balance?.balance).toBe(2);
    });

    it('should reject changing status of a request that is no longer pending', async () => {
      const res = await request(app)
        .put(`/api/leave-requests/${pendingRequestId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Rejected' });
      expect(res.status).toBe(409);
    });
  });
});
