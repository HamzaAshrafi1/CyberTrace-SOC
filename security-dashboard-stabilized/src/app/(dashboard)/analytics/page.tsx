import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch all incidents with their activities for performance telemetry
  const incidents = await prisma.incident.findMany({
    where: { organizationId: org.id },
    include: {
      activityLogs: true
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <AnalyticsClient
      orgId={org.id}
      incidents={incidents.map(i => ({
        id: i.id,
        severity: i.severity,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        activityLogs: i.activityLogs.map(l => ({
          activityType: l.activityType,
          createdAt: l.createdAt.toISOString()
        }))
      }))}
    />
  );
}
