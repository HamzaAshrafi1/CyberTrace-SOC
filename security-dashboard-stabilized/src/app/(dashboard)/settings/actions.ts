"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";

export async function createLogSourceAction(name: string) {
  const { org } = await verifyPermission("write:settings");

  if (!name || name.trim() === "") {
    throw new Error("Log source name is required");
  }

  // Generate standard API key
  const apiKey = `ls_key_${randomBytes(8).toString("hex")}`;

  const logSource = await prisma.logSource.create({
    data: {
      organizationId: org.id,
      name: name.trim(),
      apiKey,
    }
  });

  await writeAuditLog("Log Source Created", { id: logSource.id, name: logSource.name });

  revalidatePath("/settings");
  revalidatePath("/overview");
}

export async function deleteLogSourceAction(id: string) {
  const { org } = await verifyPermission("write:settings");

  // Verify ownership before deleting
  const logSource = await prisma.logSource.findFirst({
    where: {
      id,
      organizationId: org.id,
    }
  });

  if (!logSource) {
    throw new Error("Log source not found or unauthorized");
  }

  await prisma.logSource.delete({
    where: { id }
  });

  await writeAuditLog("Log Source Deleted", { id, name: logSource.name });

  revalidatePath("/settings");
  revalidatePath("/overview");
}
