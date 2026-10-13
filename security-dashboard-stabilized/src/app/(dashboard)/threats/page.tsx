import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getThreats, getThreatsCount } from "@/lib/dashboard/get-threats";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import prisma from "@/lib/prisma";
import ThreatsClient from "./ThreatsClient";

export default async function ThreatsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    q?: string; 
    severity?: string; 
    status?: string; 
    startDate?: string; 
    endDate?: string; 
    page?: string; 
  }>;
}) {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL
  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  const { q = "", severity = "", status = "", startDate = "", endDate = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = 10;
  const skip = (currentPage - 1) * itemsPerPage;

  // Query PostgreSQL via reusable helpers with clerk tenant isolation
  const [threats, totalCount, dbUsers] = await Promise.all([
    getThreats(orgId, {
      limit: itemsPerPage,
      skip,
      query: q,
      severity,
      status,
      startDate,
      endDate,
    }),
    getThreatsCount(orgId, {
      query: q,
      severity,
      status,
      startDate,
      endDate,
    }),
    prisma.user.findMany({
      where: { organizationId: org.id },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <ThreatsClient
      threats={threats.map(t => ({
        id: t.id,
        createdAt: t.createdAt,
        sourceIp: t.sourceIp,
        target: t.target,
        severity: t.severity,
        description: t.description,
        rawPayload: t.rawPayload,
        status: t.status,
        assignedTo: t.assignedTo,
        aiSummary: t.aiSummary,
        incident: t.incident ? { id: t.incident.id, title: t.incident.title } : null,
        organization: t.organization?.name || "Alpha Security Corp",
      }))}
      searchQuery={q}
      selectedSeverity={severity}
      selectedStatus={status}
      startDate={startDate}
      endDate={endDate}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      organizationUsers={dbUsers.map(u => u.email)}
    />
  );
}
