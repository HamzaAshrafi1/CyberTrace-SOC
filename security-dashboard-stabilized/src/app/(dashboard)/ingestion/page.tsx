import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import { getIngestionHistoryAction } from "./actions";
import IngestionClient from "./IngestionClient";

export default async function IngestionPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL
  await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch ingestion history list
  const history = await getIngestionHistoryAction();

  return (
    <IngestionClient
      initialHistory={history.map(h => ({
        id: h.id,
        fileName: h.fileName,
        fileSize: h.fileSize,
        eventsCount: h.eventsCount,
        threatsCount: h.threatsCount,
        incidentsCount: h.incidentsCount,
        status: h.status,
        createdAt: h.createdAt.toISOString(),
      }))}
    />
  );
}
