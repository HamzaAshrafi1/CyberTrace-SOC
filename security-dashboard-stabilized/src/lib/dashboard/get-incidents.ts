import prisma from "@/lib/prisma";

export async function getIncidents(orgId: string) {
  return prisma.incident.findMany({
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

export async function getIncidentsCount(orgId: string) {
  return prisma.incident.count({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
    },
  });
}

export async function getOpenIncidentsCount(orgId: string) {
  return prisma.incident.count({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
      status: "open",
    },
  });
}
