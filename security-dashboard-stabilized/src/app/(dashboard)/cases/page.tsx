import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import CasesClient from "./CasesClient";

export default async function CasesPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch all cases with related incidents and evidence
  const cases = await prisma.case.findMany({
    where: { organizationId: org.id },
    include: {
      incidents: true,
      evidence: true
    },
    orderBy: { createdAt: "desc" }
  });

  // Fetch all incidents without a case
  const unassignedIncidents = await prisma.incident.findMany({
    where: { organizationId: org.id, caseId: null },
    orderBy: { createdAt: "desc" }
  });

  return (
    <CasesClient
      orgId={org.id}
      initialCases={cases.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        severity: c.severity,
        assignedTo: c.assignedTo,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        incidents: c.incidents.map(i => ({
          id: i.id,
          title: i.title,
          severity: i.severity,
          status: i.status
        })),
        evidence: c.evidence.map(e => ({
          id: e.id,
          fileName: e.fileName,
          fileSize: e.fileSize,
          fileType: e.fileType,
          createdAt: e.createdAt.toISOString()
        }))
      }))}
      unassignedIncidents={unassignedIncidents.map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        createdAt: i.createdAt.toISOString()
      }))}
    />
  );
}
