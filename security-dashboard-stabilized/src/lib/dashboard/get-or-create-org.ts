import prisma from "@/lib/prisma";

export async function getOrCreateOrganization(clerkOrgId: string, name?: string) {
  const existing = await prisma.organization.findUnique({
    where: { clerkOrgId },
  });
  if (existing) return existing;

  return prisma.organization.create({
    data: {
      clerkOrgId,
      name: name || "Security Workspace",
    },
  });
}
