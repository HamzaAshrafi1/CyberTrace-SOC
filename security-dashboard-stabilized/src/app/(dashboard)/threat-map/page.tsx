import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import ThreatMapClient from "./ThreatMapClient";

export default async function ThreatMapPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in database
  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch initial threat events and incidents
  const [initialThreats, initialIncidents] = await Promise.all([
    prisma.threatEvent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.incident.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <ThreatMapClient
      orgId={org.id}
      initialThreats={initialThreats.map(t => ({
        id: t.id,
        organizationId: t.organizationId,
        sourceIp: t.sourceIp,
        target: t.target,
        severity: t.severity,
        description: t.description,
        rawPayload: t.rawPayload,
        status: t.status,
        assignedTo: t.assignedTo,
        incidentId: t.incidentId,
        createdAt: t.createdAt.toISOString(),
      }))}
      initialIncidents={initialIncidents.map(i => ({
        id: i.id,
        organizationId: i.organizationId,
        title: i.title,
        description: i.description,
        severity: i.severity,
        status: i.status,
        assignedTo: i.assignedTo,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }))}
    />
  );
}
