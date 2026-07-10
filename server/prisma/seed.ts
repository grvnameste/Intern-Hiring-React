import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const demoPassword = "Demo@123";

async function main() {
  const password = await bcrypt.hash(demoPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { name: "Admin User", role: Role.ADMIN, department: "HR" },
    create: {
      name: "Admin User",
      email: "admin@example.com",
      password,
      role: Role.ADMIN,
      department: "HR",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: { name: "Manager User", role: Role.MANAGER, department: "Engineering" },
    create: {
      name: "Manager User",
      email: "manager@example.com",
      password,
      role: Role.MANAGER,
      department: "Engineering",
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {
      name: "Employee User",
      role: Role.EMPLOYEE,
      department: "Engineering",
      managerId: manager.id,
    },
    create: {
      name: "Employee User",
      email: "employee@example.com",
      password,
      role: Role.EMPLOYEE,
      department: "Engineering",
      managerId: manager.id,
    },
  });

  const leaveTypes = await Promise.all(
    [
      { name: "Annual Leave", maxDays: 18 },
      { name: "Sick Leave", maxDays: 10 },
      { name: "Maternity Leave", maxDays: 90 },
    ].map((leaveType) =>
      prisma.leaveType.upsert({
        where: { name: leaveType.name },
        update: { maxDays: leaveType.maxDays },
        create: leaveType,
      }),
    ),
  );

  for (const user of [admin, manager, employee]) {
    for (const leaveType of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId: {
            userId: user.id,
            leaveTypeId: leaveType.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          leaveTypeId: leaveType.id,
          balance: leaveType.maxDays,
        },
      });
    }
  }

  console.log("Seed data created for admin, manager, employee, leave types, and balances.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
