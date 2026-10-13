"use server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
export async function runComplianceAudit(frameworks: string[]) {
  const { org } = await verifyPermission("write:compliance");
  const allowed = ["ISO 27001", "CIS Benchmarks", "OWASP Top 10", "GDPR"];
  if (!frameworks.length || frameworks.some(f => !allowed.includes(f))) throw new Error("Invalid frameworks");
  await prisma.$transaction(async tx => {
    for (const framework of [...new Set(frameworks)]) {
      await tx.complianceCheck.deleteMany({ where: { organizationId: org.id, framework: { startsWith: framework } } });
      await tx.complianceCheck.create({ data: {
        organizationId: org.id, framework,
        description: "Unverified checklist: no evidence-backed control assessment has been implemented. Score 0 means not assessed, not failed.",
        score: 0, status: "unverified",
      }});
    }
  });
  await writeAuditLog("Compliance Checklist Requested", { frameworks, status: "unverified" });
  revalidatePath("/compliance"); revalidatePath("/overview"); revalidatePath("/reports");
}
