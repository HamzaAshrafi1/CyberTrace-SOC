"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";

export async function updateIncidentStatus(incidentId: string, status: string) {
  const { org } = await verifyPermission("write:incidents");

  try {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, organizationId: org.id },
    });
    if (!incident) throw new Error("Incident not found or unauthorized");

    await prisma.incident.update({
      where: { id: incidentId },
      data: { status, updatedAt: new Date() },
    });

    await writeAuditLog("Incident Status Change", { id: incidentId, status });

    revalidatePath("/incidents");
  } catch (error: any) {
    console.error("Failed to update incident status:", error);
    throw new Error(error.message || "Database update failed");
  }
}

export async function assignIncidentToSelf(incidentId: string, analystEmail: string) {
  const { org } = await verifyPermission("write:incidents");

  try {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, organizationId: org.id },
    });
    if (!incident) throw new Error("Incident not found or unauthorized");

    await prisma.incident.update({
      where: { id: incidentId },
      data: { 
        assignedTo: analystEmail, 
        status: "investigating", 
        updatedAt: new Date() 
      },
    });

    await writeAuditLog("Incident Assignment", { id: incidentId, assignedTo: analystEmail });

    revalidatePath("/incidents");
  } catch (error: any) {
    console.error("Failed to assign incident:", error);
    throw new Error(error.message || "Database update failed");
  }
}
