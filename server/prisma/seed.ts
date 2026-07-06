import 'dotenv/config';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // 1. Create LeaveTypes
  const annualLeave = await prisma.leaveType.upsert({
    where: { name: 'Annual' },
    update: {},
    create: { name: 'Annual', maxDays: 20 },
  });

  const sickLeave = await prisma.leaveType.upsert({
    where: { name: 'Sick' },
    update: {},
    create: { name: 'Sick', maxDays: 10 },
  });

  const maternityLeave = await prisma.leaveType.upsert({
    where: { name: 'Maternity' },
    update: {},
    create: { name: 'Maternity', maxDays: 90 },
  });

  const leaveTypes = [annualLeave, sickLeave, maternityLeave];
  console.log('Created LeaveTypes');

  // 2. Create Users
  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123', 
      role: Role.Admin,
      department: 'HR',
    },
  });

  // Managers
  const manager1 = await prisma.user.upsert({
    where: { email: 'manager1@example.com' },
    update: {},
    create: {
      name: 'Manager One',
      email: 'manager1@example.com',
      password: 'password123',
      role: Role.Manager,
      department: 'Engineering',
      managerId: admin.id,
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@example.com' },
    update: {},
    create: {
      name: 'Manager Two',
      email: 'manager2@example.com',
      password: 'password123',
      role: Role.Manager,
      department: 'Marketing',
      managerId: admin.id,
    },
  });

  // Employees
  const employees = [
    { name: 'Emp One', email: 'emp1@example.com', managerId: manager1.id, dept: 'Engineering' },
    { name: 'Emp Two', email: 'emp2@example.com', managerId: manager1.id, dept: 'Engineering' },
    { name: 'Emp Three', email: 'emp3@example.com', managerId: manager1.id, dept: 'Engineering' },
    { name: 'Emp Four', email: 'emp4@example.com', managerId: manager2.id, dept: 'Marketing' },
    { name: 'Emp Five', email: 'emp5@example.com', managerId: manager2.id, dept: 'Marketing' },
    { name: 'Emp Six', email: 'emp6@example.com', managerId: manager2.id, dept: 'Marketing' },
  ];

  const createdUsers = [admin, manager1, manager2];

  for (const emp of employees) {
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        name: emp.name,
        email: emp.email,
        password: 'password123',
        role: Role.Employee,
        department: emp.dept,
        managerId: emp.managerId,
      },
    });
    createdUsers.push(user);
  }
  console.log('Created Users');

  // 3. Create Initial Leave Balances
  for (const user of createdUsers) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId: {
            userId: user.id,
            leaveTypeId: lt.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          leaveTypeId: lt.id,
          balance: lt.maxDays,
        },
      });
    }
  }
  console.log('Created Leave Balances');
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
