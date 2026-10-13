import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import VaultClient from "./VaultClient";

export default async function VaultPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch all evidence records of the organization (B2B isolation)
  const evidence = await prisma.evidence.findMany({
    where: { organizationId: org.id },
    include: {
      case: true
    },
    orderBy: { createdAt: "desc" }
  });

  // Fetch active cases to link files to
  const cases = await prisma.case.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <VaultClient
      orgId={org.id}
      initialEvidence={evidence.map(e => ({
        id: e.id,
        fileName: e.fileName,
        fileSize: e.fileSize,
        fileType: e.fileType,
        createdAt: e.createdAt.toISOString(),
        caseId: e.caseId,
        caseTitle: e.case?.title || null
      }))}
      cases={cases.map(c => ({
        id: c.id,
        title: c.title
      }))}
    />
  );
}
