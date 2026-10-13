import prisma from "@/lib/prisma";

export async function getComplianceChecks(orgId: string) {
  return prisma.complianceCheck.findMany({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getComplianceChecksCount(orgId: string) {
  return prisma.complianceCheck.count({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
    },
  });
}
