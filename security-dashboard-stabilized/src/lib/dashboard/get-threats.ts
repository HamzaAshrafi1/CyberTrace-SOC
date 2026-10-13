import prisma from "@/lib/prisma";

export async function getThreats(
  orgId: string,
  limitOrOptions?: number | {
    limit?: number;
    skip?: number;
    query?: string;
    severity?: string;
    status?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }
) {
  let take: number | undefined;
  let skip: number | undefined;
  let query: string | undefined;
  let severity: string | undefined;
  let status: string | undefined;
  let startDate: string | Date | undefined;
  let endDate: string | Date | undefined;

  if (typeof limitOrOptions === "number") {
    take = limitOrOptions;
  } else if (limitOrOptions) {
    take = limitOrOptions.limit;
    skip = limitOrOptions.skip;
    query = limitOrOptions.query;
    severity = limitOrOptions.severity;
    status = limitOrOptions.status;
    startDate = limitOrOptions.startDate;
    endDate = limitOrOptions.endDate;
  }

  const andConditions: any[] = [];

  if (query) {
    andConditions.push({
      OR: [
        { sourceIp: { contains: query, mode: "insensitive" } },
        { target: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { rawPayload: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (severity) {
    andConditions.push({
      severity: { equals: severity, mode: "insensitive" },
    });
  }

  if (status) {
    andConditions.push({
      status: { equals: status, mode: "insensitive" },
    });
  }

  if (startDate) {
    andConditions.push({
      createdAt: { gte: new Date(startDate) },
    });
  }

  if (endDate) {
    andConditions.push({
      createdAt: { lte: new Date(endDate) },
    });
  }

  return prisma.threatEvent.findMany({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
      AND: andConditions,
    },
    include: {
      incident: true,
      organization: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: take,
    skip: skip,
  });
}

export async function getThreatsCount(
  orgId: string,
  options?: {
    query?: string;
    severity?: string;
    status?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }
) {
  const { query, severity, status, startDate, endDate } = options || {};
  
  const andConditions: any[] = [];

  if (query) {
    andConditions.push({
      OR: [
        { sourceIp: { contains: query, mode: "insensitive" } },
        { target: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { rawPayload: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (severity) {
    andConditions.push({
      severity: { equals: severity, mode: "insensitive" },
    });
  }

  if (status) {
    andConditions.push({
      status: { equals: status, mode: "insensitive" },
    });
  }

  if (startDate) {
    andConditions.push({
      createdAt: { gte: new Date(startDate) },
    });
  }

  if (endDate) {
    andConditions.push({
      createdAt: { lte: new Date(endDate) },
    });
  }

  return prisma.threatEvent.count({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
      AND: andConditions,
    },
  });
}

export async function getCriticalThreatsCount(orgId: string) {
  return prisma.threatEvent.count({
    where: {
      organization: {
        clerkOrgId: orgId,
      },
      severity: { equals: "CRITICAL", mode: "insensitive" },
    },
  });
}
