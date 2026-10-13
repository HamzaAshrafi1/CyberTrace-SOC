"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
import { sanitizeString } from "@/lib/dashboard/security";

export async function executeHuntAction(
  query: string,
  sources: string[] = [],
  limit: number = 50,
  offset: number = 0
) {
  const { org } = await verifyPermission("read:hunts");
  const sanitizedQuery = sanitizeString(query);

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/hunt/search`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "read:hunts"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: org.id,
        query: sanitizedQuery,
        sources,
        limit,
        offset,
      }),
      signal: AbortSignal.timeout(12000), // longer timeout for complex searches
    });

    if (!response.ok) {
      throw new Error(`FastAPI service returned status ${response.status}`);
    }

    const data = await response.json();
    
    // Log search event
    await writeAuditLog("Threat Hunt Executed", {
      query: sanitizedQuery,
      sources,
      limit,
      offset,
      resultsCount: data.results?.length || 0,
    });

    return data;
  } catch (error) {
    console.error("Failed to execute threat hunt search action:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to execute search");
  }
}

export async function translateAiHuntAction(nlQuery: string) {
  const { org } = await verifyPermission("read:hunts");
  const sanitizedNlQuery = sanitizeString(nlQuery);

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/hunt/ai`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "read:hunts"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: org.id,
        query: sanitizedNlQuery,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`FastAPI service returned status ${response.status}`);
    }

    const data = await response.json();

    await writeAuditLog("AI Threat Hunt Query Generated", {
      naturalLanguageQuery: sanitizedNlQuery,
      generatedAqlQuery: data.query,
    });

    return data;
  } catch (error) {
    console.error("AI Hunt translation action failed:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to translate query");
  }
}

// --- SAVED HUNTS CRUD ACTIONS ---

export async function getSavedHuntsAction() {
  const { org } = await verifyPermission("read:hunts");

  return prisma.savedHunt.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSavedHuntAction(
  name: string,
  query: string,
  description?: string
) {
  const { org, user } = await verifyPermission("write:hunts");
  const sanitizedName = sanitizeString(name);
  const sanitizedQuery = sanitizeString(query);
  const sanitizedDesc = description ? sanitizeString(description) : undefined;

  const savedHunt = await prisma.savedHunt.create({
    data: {
      organizationId: org.id,
      name: sanitizedName,
      query: sanitizedQuery,
      description: sanitizedDesc,
      createdBy: user.email,
    },
  });

  await writeAuditLog("Saved Hunt Created", {
    id: savedHunt.id,
    name: savedHunt.name,
    query: savedHunt.query,
  });

  revalidatePath("/hunt");
  return savedHunt;
}

export async function editSavedHuntAction(
  id: string,
  name: string,
  query: string,
  description?: string
) {
  const { org } = await verifyPermission("write:hunts");
  const sanitizedName = sanitizeString(name);
  const sanitizedQuery = sanitizeString(query);
  const sanitizedDesc = description ? sanitizeString(description) : undefined;

  const hunt = await prisma.savedHunt.findFirst({
    where: { id, organizationId: org.id },
  });

  if (!hunt) throw new Error("Saved hunt not found or unauthorized");

  const updatedHunt = await prisma.savedHunt.update({
    where: { id },
    data: {
      name: sanitizedName,
      query: sanitizedQuery,
      description: sanitizedDesc,
    },
  });

  await writeAuditLog("Saved Hunt Updated", {
    id: updatedHunt.id,
    name: updatedHunt.name,
    query: updatedHunt.query,
  });

  revalidatePath("/hunt");
  return updatedHunt;
}

export async function deleteSavedHuntAction(id: string) {
  const { org } = await verifyPermission("write:hunts");

  const hunt = await prisma.savedHunt.findFirst({
    where: { id, organizationId: org.id },
  });

  if (!hunt) throw new Error("Saved hunt not found or unauthorized");

  await prisma.savedHunt.delete({
    where: { id },
  });

  await writeAuditLog("Saved Hunt Deleted", {
    id: hunt.id,
    name: hunt.name,
  });

  revalidatePath("/hunt");
  return { success: true };
}

export async function getHuntAnalyticsAction() {
  const { org } = await verifyPermission("read:hunts");

  // 1. Fetch datasets from PostgreSQL
  const [threatEvents, savedHuntsCount] = await Promise.all([
    prisma.threatEvent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.savedHunt.count({
      where: { organizationId: org.id },
    }),
  ]);

  // 2. Aggregate Top Attack Types
  const attackCounts: Record<string, number> = {};
  threatEvents.forEach(e => {
    const type = e.description || "CLEAN";
    attackCounts[type] = (attackCounts[type] || 0) + 1;
  });
  const topAttackTypes = Object.entries(attackCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 3. Aggregate Top Source Countries
  const getIpCountryJs = (ip: string): string => {
    if (!ip) return "Unknown";
    if (ip.startsWith("192.168.") || ip.startsWith("10.")) return "Internal";
    return "Unknown";
  };

  const countryCounts: Record<string, number> = {};
  threatEvents.forEach(e => {
    const country = getIpCountryJs(e.sourceIp);
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  });
  const topCountries = Object.entries(countryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 4. Aggregate Top Targets
  const targetCounts: Record<string, number> = {};
  threatEvents.forEach(e => {
    const target = e.target || "Unknown System";
    targetCounts[target] = (targetCounts[target] || 0) + 1;
  });
  const topTargets = Object.entries(targetCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 5. Threat Discovery Trend (group by day)
  const dayCounts: Record<string, number> = {};
  threatEvents.slice(0, 200).forEach(e => {
    const dateStr = new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
  });
  const discoveryTrend = Object.entries(dayCounts)
    .map(([date, count]) => ({ date, count }))
    .reverse();

  // 6. Stats calculations
  const totalThreats = threatEvents.length;
  const criticalThreats = threatEvents.filter(e => e.severity === "CRITICAL").length;
  const highThreats = threatEvents.filter(e => e.severity === "HIGH").length;
  
  const triagedThreats = threatEvents.filter(e => e.status !== "New").length;
  const successRate = totalThreats > 0 ? Math.round((triagedThreats / totalThreats) * 100) : 0;

  return {
    totalThreats,
    criticalThreats,
    highThreats,
    savedHuntsCount,
    successRate,
    topAttackTypes,
    topCountries,
    topTargets,
    discoveryTrend,
  };
}
