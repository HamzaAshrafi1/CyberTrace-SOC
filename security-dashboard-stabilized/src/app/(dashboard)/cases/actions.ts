"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { verifyPermission } from "@/lib/dashboard/verify-permission";

export async function createCaseAction(formData: {
  title: string;
  description: string;
  severity: string;
  assignedTo: string;
}) {
  const { org } = await verifyPermission("write:incidents");

  const newCase = await prisma.case.create({
    data: {
      organizationId: org.id,
      title: formData.title,
      description: formData.description,
      severity: formData.severity,
      assignedTo: formData.assignedTo,
    }
  });

  // Log audit
  await writeAuditLog("CASE_CREATED", { caseId: newCase.id, title: newCase.title });

  revalidatePath("/cases");
  return newCase;
}

export async function updateCaseStatusAction(caseId: string, status: string) {
  const { org } = await verifyPermission("write:incidents");

  const updatedCase = await prisma.case.update({
    where: { id: caseId, organizationId: org.id },
    data: { status }
  });

  // Log audit
  await writeAuditLog("CASE_STATUS_UPDATED", { caseId: caseId, status });

  revalidatePath("/cases");
  return updatedCase;
}

export async function linkIncidentToCaseAction(incidentId: string, caseId: string | null) {
  const { org } = await verifyPermission("write:incidents");

  if (caseId && !await prisma.case.findFirst({ where: { id: caseId, organizationId: org.id } })) {
    throw new Error("Case not found or unauthorized");
  }
  const updatedIncident = await prisma.incident.update({
    where: { id: incidentId, organizationId: org.id },
    data: { caseId }
  });

  // Log audit
  await writeAuditLog(
    caseId ? "INCIDENT_LINKED_TO_CASE" : "INCIDENT_UNLINKED_FROM_CASE",
    { incidentId, caseId }
  );

  revalidatePath("/cases");
  return updatedIncident;
}
