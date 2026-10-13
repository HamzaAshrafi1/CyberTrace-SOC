import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getComplianceChecks } from "@/lib/dashboard/get-compliance";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import ComplianceClient from "./ComplianceClient";

export default async function CompliancePage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL
  await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch live compliance checks from Neon database
  const complianceChecks = await getComplianceChecks(orgId);

  return (
    <ComplianceClient
      complianceChecks={complianceChecks.map(check => ({
        id: check.id,
        framework: check.framework,
        description: check.description,
        score: check.score,
        status: check.status,
        createdAt: check.createdAt,
      }))}
    />
  );
}
