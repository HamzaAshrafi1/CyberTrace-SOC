"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
import { sanitizeString } from "@/lib/dashboard/security";

export async function updateThreatStatusAction(threatId: string, status: string) {
  const { org } = await verifyPermission("write:threats");
  const sanitizedStatus = sanitizeString(status);

  const threat = await prisma.threatEvent.findFirst({
    where: { id: threatId, organizationId: org.id },
  });
  if (!threat) throw new Error("Threat not found or unauthorized");

  await prisma.threatEvent.update({
    where: { id: threatId },
    data: { status: sanitizedStatus },
  });

  await writeAuditLog("Threat Status Change", { id: threatId, status: sanitizedStatus });

  revalidatePath("/threats");
  revalidatePath("/overview");
}

export async function updateThreatAssigneeAction(threatId: string, assignee: string) {
  const { org } = await verifyPermission("write:threats");
  const sanitizedAssignee = sanitizeString(assignee);

  const threat = await prisma.threatEvent.findFirst({
    where: { id: threatId, organizationId: org.id },
  });
  if (!threat) throw new Error("Threat not found or unauthorized");

  await prisma.threatEvent.update({
    where: { id: threatId },
    data: { assignedTo: sanitizedAssignee },
  });

  await writeAuditLog("Threat Assignment", { id: threatId, assignedTo: sanitizedAssignee });

  revalidatePath("/threats");
  revalidatePath("/overview");
}

export async function generateThreatAiSummaryAction(threatId: string) {
  const { org } = await verifyPermission("write:threats");

  const threat = await prisma.threatEvent.findFirst({
    where: { id: threatId, organizationId: org.id },
  });
  if (!threat) throw new Error("Threat not found or unauthorized");

  let summaryText = "";

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/summarize`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:threats"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        incident_id: threat.id,
        category: threat.description || "UNKNOWN_THREAT",
        description: threat.rawPayload || "No payload provided",
        threat_count: 1,
      }),
      // Add a short timeout to prevent hanging the Next.js server if Python service is down
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = await response.json();
      summaryText = data.summary;
    } else {
      throw new Error(`FastAPI service returned status ${response.status}`);
    }
  } catch (error) {
    console.warn("Fallback to local heuristic AI threat summary:", error);
    
    // Heuristic fallback text matching the required sections
    summaryText = `### [Local AI Threat Summary Fallback: ${threat.id}]
 
**1. Executive Summary:**
An active security event was captured where source IP \`${threat.sourceIp}\` targeted node \`${threat.target}\` with a signature matching \`${threat.description}\`. This signature is flagged under the \`${threat.severity}\` risk bracket.
 
**2. Severity Reasoning:**
The payload includes signatures targeting command or parameter input fields, which suggests an scanning tool or active intrusion probe. The risk level is elevated to \`${threat.severity}\` because it targets core ingress application endpoints.
 
**3. Remediation Actions:**
1. Quarantine and block traffic from IP \`${threat.sourceIp}\` at the border gateway/WAF.
2. Review target node \`${threat.target}\` logs for response status codes (e.g., 200 vs 403) to check if the attack succeeded.
3. Validate sanitization logic for user inputs associated with the matching query vector.`;
  }

  // Persist the summary in the database
  await prisma.threatEvent.update({
    where: { id: threatId },
    data: { aiSummary: summaryText },
  });

  await writeAuditLog("Threat AI Summary Generated", { id: threatId });

  revalidatePath("/threats");
  return summaryText;
}

export async function getRelatedThreatEventsAction(threatId: string, sourceIp: string, target: string) {
  const { org } = await verifyPermission("read:threats");

  const [ipThreats, targetThreats] = await Promise.all([
    prisma.threatEvent.findMany({
      where: {
        organizationId: org.id,
        sourceIp: sourceIp,
        id: { not: threatId },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.threatEvent.findMany({
      where: {
        organizationId: org.id,
        target: target,
        id: { not: threatId },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    ipThreats: ipThreats.map(t => ({
      id: t.id,
      createdAt: t.createdAt,
      severity: t.severity,
      description: t.description,
    })),
    targetThreats: targetThreats.map(t => ({
      id: t.id,
      createdAt: t.createdAt,
      severity: t.severity,
      description: t.description,
    })),
  };
}
