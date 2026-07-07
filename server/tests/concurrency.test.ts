/**
 * Concurrency test: Approving the same leave request twice simultaneously.
 *
 * Fires two simultaneous `approveLeaveRequest` calls against the same balance row.
 * Asserts that:
 *  1. Exactly ONE succeeds (returns the updated request).
 *  2. Exactly ONE fails with ConflictError.
 *  3. The balance NEVER goes negative — it is either decremented once (≥ 0) or unchanged.
 *
 * This test requires a real Postgres database — it intentionally validates
 * the atomic `updateMany ... WHERE balance >= days` guard described in ARCHITECTURE.md §4.
 *
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { approveLeaveRequest } from '../src/services/leaveRequest.service.js';
import { ConflictError } from '../src/utils/errors.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log('=== Concurrency Test: Dual Approval ===\n');


  const manager = await prisma.user.create({
    data: {
      name: 'Test Manager',
      email: `mgr-${Date.now()}@test.local`,
      password: 'hashed',
      role: 'Manager',
    },
  });

  const employee = await prisma.user.create({
    data: {
      name: 'Test Employee',
      email: `emp-${Date.now()}@test.local`,
      password: 'hashed',
      role: 'Employee',
      managerId: manager.id,
    },
  });

  const leaveType = await prisma.leaveType.create({
    data: { name: `Concurrency-Test-LT-${Date.now()}`, maxDays: 10 },
  });

  const INITIAL_BALANCE = 3;
  await prisma.leaveBalance.create({
    data: {
      userId: employee.id,
      leaveTypeId: leaveType.id,
      balance: INITIAL_BALANCE,
    },
  });

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 2);

  const request = await prisma.leaveRequest.create({
    data: {
      userId: employee.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      reason: 'Concurrency test leave',
      status: 'Pending',
    },
  });

  console.log(`Created request ${request.id} for ${INITIAL_BALANCE} days`);
  console.log('Firing two simultaneous approvals...\n');


  const results = await Promise.allSettled([
    approveLeaveRequest(request.id, manager.id),
    approveLeaveRequest(request.id, manager.id),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  console.log(`Fulfilled: ${fulfilled.length}`);
  console.log(`Rejected:  ${rejected.length}`);

  if (rejected.length > 0) {
    for (const r of rejected) {
      if (r.status === 'rejected') {
        console.log(`  Rejection reason: ${(r.reason as Error).constructor.name} — ${(r.reason as Error).message}`);
      }
    }
  }


  let passed = true;

  if (fulfilled.length !== 1) {
    console.error(`\n❌ FAIL: Expected exactly 1 success, got ${fulfilled.length}`);
    passed = false;
  } else {
    console.log('\n✅ PASS: Exactly one approval succeeded');
  }

  const conflictErrors = rejected.filter(
    (r) => r.status === 'rejected' && r.reason instanceof ConflictError,
  );
  if (conflictErrors.length !== 1) {
    console.error(`❌ FAIL: Expected exactly 1 ConflictError, got ${conflictErrors.length}`);
    passed = false;
  } else {
    console.log('✅ PASS: Second attempt rejected with ConflictError');
  }

  // Balance must never go negative
  const finalBalance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId: { userId: employee.id, leaveTypeId: leaveType.id } },
  });

  if (!finalBalance || finalBalance.balance < 0) {
    console.error(`❌ FAIL: Balance went negative! Value: ${finalBalance?.balance}`);
    passed = false;
  } else {
    console.log(`✅ PASS: Balance is ${finalBalance.balance} (never went negative)`);
  }

 
  await prisma.leaveRequest.deleteMany({ where: { userId: employee.id } });
  await prisma.leaveBalance.deleteMany({ where: { userId: employee.id } });
  await prisma.user.delete({ where: { id: employee.id } });
  await prisma.leaveType.delete({ where: { id: leaveType.id } });
  await prisma.user.delete({ where: { id: manager.id } });

  await pool.end();

  if (passed) {
    console.log('\n🎉 All concurrency assertions passed!');
    process.exit(0);
  } else {
    console.error('\n💥 One or more concurrency assertions FAILED');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
