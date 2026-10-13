import prisma from "@/lib/prisma";

export async function getLogSources(orgId: string) {
  return prisma.logSource.findMany({
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
