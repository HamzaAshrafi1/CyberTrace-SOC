import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getThreats, getThreatsCount, getCriticalThreatsCount } from "@/lib/dashboard/get-threats";
import { getOpenIncidentsCount } from "@/lib/dashboard/get-incidents";
import { getComplianceChecks } from "@/lib/dashboard/get-compliance";
import { getLogSources } from "@/lib/dashboard/get-log-sources";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import OverviewClient from "./OverviewClient";

export default async function OverviewPage() {
  const { orgId, orgSlug } = await auth();
  console.log("CURRENT CLERK ORG:", orgId);
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL
  await getOrCreateOrganization(orgId, orgSlug || undefined);

  // 1. Fetch real B2B tenant metrics
  const [
    totalThreats,
    criticalThreats,
    openIncidents,
    complianceChecks,
    logSources,
    recentThreatsList
  ] = await Promise.all([
    getThreatsCount(orgId),
    getCriticalThreatsCount(orgId),
    getOpenIncidentsCount(orgId),
    getComplianceChecks(orgId),
    getLogSources(orgId),
    getThreats(orgId, 10),
  ]);

  const totalLogSources = logSources.length;

  // 2. Calculate average compliance framework score
  let complianceScore = 0;
  if (complianceChecks.length > 0) {
    const sum = complianceChecks.reduce((acc, check) => acc + check.score, 0);
    complianceScore = sum / complianceChecks.length;
  }

  // 3. Process Live Chart Analytics based on database records using optimized aggregations
  const categoryAggregates = await prisma.threatEvent.groupBy({
    by: ["description"],
    where: {
      organization: {
        clerkOrgId: orgId,
      },
    },
    _count: {
      _all: true,
    },
  });

  const chartCategoryData = categoryAggregates.map(agg => {
    const name = agg.description || "Unknown";
    const count = agg._count._all;
    let fill = "var(--cyber-blue)";
    if (name === "COMMAND_INJECTION") {
      fill = "var(--cyber-red)";
    } else if (name === "SQL_INJECTION") {
      fill = "var(--cyber-orange)";
    } else if (name === "XSS") {
      fill = "var(--cyber-pink)";
    } else if (name === "DIRECTORY_TRAVERSAL") {
      fill = "var(--cyber-yellow)";
    } else if (name === "BRUTE_FORCE") {
      fill = "var(--cyber-purple)";
    }
    return { name, count, fill };
  });

  // Fetch only threat counts aggregated by 4-hour hour buckets in the last 24 hours (fully on DB-side)
  const velocityAggregates = await prisma.$queryRaw<
    { bucket: number; count: number }[]
  >`
    SELECT 
      floor(extract(hour from t."createdAt") / 4)::integer as bucket,
      count(*)::integer as count
    FROM "ThreatEvent" t
    JOIN "Organization" o ON t."organizationId" = o.id
    WHERE o."clerkOrgId" = ${orgId} AND t."createdAt" >= NOW() - INTERVAL '24 hours'
    GROUP BY bucket
  `;

  const chartVelocityData = [
    { time: "00:00", attacks: 0 },
    { time: "04:00", attacks: 0 },
    { time: "08:00", attacks: 0 },
    { time: "12:00", attacks: 0 },
    { time: "16:00", attacks: 0 },
    { time: "20:00", attacks: 0 },
    { time: "24:00", attacks: 0 },
  ];

  velocityAggregates.forEach(agg => {
    const index = Math.min(Math.max(0, agg.bucket), 6);
    chartVelocityData[index].attacks = agg.count;
  });

  return (
    <OverviewClient
      totalThreats={totalThreats}
      criticalThreats={criticalThreats}
      openIncidents={openIncidents}
      complianceScore={complianceScore}
      totalLogSources={totalLogSources}
      recentThreats={recentThreatsList}
      chartVelocityData={chartVelocityData}
      chartCategoryData={chartCategoryData}
    />
  );
}
