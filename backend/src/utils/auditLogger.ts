import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const logAudit = async (action: string, userId: string | null, details: Record<string, any> = {}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        details,
      },
    });
  } catch (error) {
    // Non-blocking: Audit logging must never interrupt the main operation.
    console.error(`[AuditLog Error] Failed to log action ${action}:`, error);
  }
};
