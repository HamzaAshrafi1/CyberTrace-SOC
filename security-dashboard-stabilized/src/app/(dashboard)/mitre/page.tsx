import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import MitreClient from "./MitreClient";

export default async function MitrePage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Query database aggregations for threat categories and severities
  const aggregates = await prisma.threatEvent.groupBy({
    by: ["description", "severity"],
    where: { organizationId: org.id },
    _count: {
      _all: true
    }
  });

  return (
    <MitreClient
      orgId={org.id}
      aggregates={aggregates.map(a => ({
        description: a.description,
        severity: a.severity,
        count: a._count._all,
      }))}
    />
  );
}
