import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Leave Types
  const sickLeave = await prisma.leaveType.upsert({
    where: { name: 'Sick Leave' },
    update: {},
    create: {
      name: 'Sick Leave',
      description: 'Leave for medical reasons',
      defaultDays: 10,
      requiresAttachment: true,
    }
  });

  const vacationLeave = await prisma.leaveType.upsert({
    where: { name: 'Vacation' },
    update: {},
    create: {
      name: 'Vacation',
      description: 'Annual vacation leave',
      defaultDays: 15,
      requiresAttachment: false,
    }
  });

  // Create Department
  const dept = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering', description: 'Engineering department' }
  });

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@company.com',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    }
  });

  // Create Manager User
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@company.com' },
    update: {},
    create: {
      firstName: 'Alice',
      lastName: 'Manager',
      email: 'manager@company.com',
      passwordHash: managerPassword,
      role: Role.MANAGER,
      departmentId: dept.id,
    }
  });

  // Create Employee User
  const employeePassword = await bcrypt.hash('employee123', 10);
  const employee = await prisma.user.upsert({
    where: { email: 'employee@company.com' },
    update: {},
    create: {
      firstName: 'Bob',
      lastName: 'Employee',
      email: 'employee@company.com',
      passwordHash: employeePassword,
      role: Role.EMPLOYEE,
      departmentId: dept.id,
      managerId: manager.id,
    }
  });

  // Create initial balances for the employee
  const year = new Date().getFullYear();
  await prisma.leaveBalance.upsert({
    where: { userId_leaveTypeId_year: { userId: employee.id, leaveTypeId: sickLeave.id, year } },
    update: {},
    create: {
      userId: employee.id,
      leaveTypeId: sickLeave.id,
      year,
      totalDays: sickLeave.defaultDays,
      usedDays: 0,
    }
  });

  await prisma.leaveBalance.upsert({
    where: { userId_leaveTypeId_year: { userId: employee.id, leaveTypeId: vacationLeave.id, year } },
    update: {},
    create: {
      userId: employee.id,
      leaveTypeId: vacationLeave.id,
      year,
      totalDays: vacationLeave.defaultDays,
      usedDays: 0,
    }
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
