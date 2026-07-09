import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

const DEFAULT_DEPARTMENTS = [
  { name: 'Engineering', description: 'Engineering department' },
  { name: 'Human Resources (HR)', description: 'Human Resources department' },
  { name: 'Finance', description: 'Finance department' },
  { name: 'Sales', description: 'Sales department' },
  { name: 'Marketing', description: 'Marketing department' },
  { name: 'Operations', description: 'Operations department' },
  { name: 'IT', description: 'IT department' },
  { name: 'Support', description: 'Support department' },
];

export async function initializeDatabase() {
  try {
    logger.info('Initializing database...');

    for (const dept of DEFAULT_DEPARTMENTS) {
      await prisma.department.upsert({
        where: { name: dept.name },
        update: {},
        create: dept,
      });
    }

    logger.info('Default departments are ready.');
  } catch (error) {
    logger.error(`Database initialization failed: ${error}`);
  }
}