import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import { getReportsHistoryAction } from "./actions";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL (isolation partition)
  await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch initial report compile logs from database
  const reports = await getReportsHistoryAction();

  return (
    <ReportsClient
      initialHistory={reports.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        generatedBy: r.generatedBy,
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata,
      }))}
    />
  );
}
