import prisma from "@/lib/prisma";
import { getOrCreateUserAndRole } from "./verify-permission";

export async function writeAuditLog(action: string, metadata: any) {
  try {
    const { user, org } = await getOrCreateUserAndRole();
    return await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        userEmail: user.email,
        action,
        metadata: metadata || {},
      }
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
