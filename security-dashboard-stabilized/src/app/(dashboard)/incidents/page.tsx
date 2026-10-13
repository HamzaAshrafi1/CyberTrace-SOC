import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getIncidents } from "@/lib/dashboard/get-incidents";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import IncidentsClient from "./IncidentsClient";

export default async function IncidentsPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL
  await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch current user from Clerk
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress || "Analyst_01";

  // Fetch tenant-isolated incidents from Neon database
  const incidents = await getIncidents(orgId);

  return (
    <IncidentsClient
      incidents={incidents.map(inc => ({
        id: inc.id,
        title: inc.title,
        status: inc.status,
        assignedTo: inc.assignedTo,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
      }))}
      currentUserEmail={email}
    />
  );
}
