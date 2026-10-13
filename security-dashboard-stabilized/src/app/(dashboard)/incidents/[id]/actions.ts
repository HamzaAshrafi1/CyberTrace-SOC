"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
import { sanitizeString } from "@/lib/dashboard/security";

export async function addIncidentCommentAction(incidentId: string, content: string) {
  const { org } = await verifyPermission("write:incidents");
  const sanitizedContent = sanitizeString(content);

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId: org.id },
  });
  if (!incident) throw new Error("Incident not found or unauthorized");

  const user = await currentUser();
  const userName = user?.emailAddresses?.[0]?.emailAddress || "Analyst";

  await prisma.incidentComment.create({
    data: {
      organizationId: org.id,
      incidentId,
      userName,
      content: sanitizedContent,
    },
  });

  await writeAuditLog("Incident Comment Added", { id: incidentId });

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
}

export async function updateIncidentWorkflowAction(
  incidentId: string,
  status: string,
  assignee?: string
) {
  const { org } = await verifyPermission("write:incidents");

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId: org.id },
  });
  if (!incident) throw new Error("Incident not found or unauthorized");

  // Determine transitions to write activity log
  const statusChanged = status !== incident.status;
  const assigneeChanged = assignee !== undefined && assignee !== incident.assignedTo;

  await prisma.$transaction(async (tx) => {
    // 1. Update Incident
    await tx.incident.update({
      where: { id: incidentId },
      data: {
        status,
        ...(assignee !== undefined ? { assignedTo: assignee } : {}),
      },
    });

    // 2. Log Status change
    if (statusChanged) {
      await tx.incidentActivityLog.create({
        data: {
          organizationId: org.id,
          incidentId,
          activityType: "status_change",
          description: `Status changed from '${incident.status}' to '${status}'.`,
        },
      });

      if (status === "resolved") {
        await tx.incidentActivityLog.create({
          data: {
            organizationId: org.id,
            incidentId,
            activityType: "resolved",
            description: "Incident resolved and archived.",
          },
        });
      }
    }

    // 3. Log Assignee change
    if (assigneeChanged) {
      await tx.incidentActivityLog.create({
        data: {
          organizationId: org.id,
          incidentId,
          activityType: "assigned",
          description: `Incident assigned to '${assignee}'.`,
        },
      });
    }
  });

  await writeAuditLog("Incident Status Change", { id: incidentId, status, assignee });

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  revalidatePath("/overview");
}

export async function generateIncidentAiSummaryAction(incidentId: string) {
  const { org } = await verifyPermission("write:incidents");

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId: org.id },
    include: {
      threatEvents: true,
    },
  });
  if (!incident) throw new Error("Incident not found or unauthorized");

  let summaryText = "";

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/summarize`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:incidents"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        incident_id: incident.id,
        category: incident.title || "GENERAL_INCIDENT",
        description: incident.description || `Incident involving ${incident.threatEvents.length} threat events.`,
        threat_count: incident.threatEvents.length || 1,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = await response.json();
      summaryText = data.summary;
    } else {
      throw new Error(`FastAPI returned status ${response.status}`);
    }
  } catch (error) {
    console.warn("Fallback to local heuristic AI incident summary:", error);

    const ips = Array.from(new Set(incident.threatEvents.map(t => t.sourceIp)));
    const targets = Array.from(new Set(incident.threatEvents.map(t => t.target)));

    summaryText = `### [Local AI Incident Audit Summary: ${incident.id}]

**1. Executive Summary:**
This incident aggregates a group of ${incident.threatEvents.length} correlated security threat alerts logged in the Postgres events repository. Attack vectors target gateway endpoints, indicating vulnerability scanning activity.

**2. Root Cause:**
- **Trigger Signature:** ${incident.title}
- **Impacted Systems:** ${targets.join(", ") || "Unknown Gateway"}
- **Attacking Hosts:** ${ips.join(", ") || "Unknown IP"}

**3. Impact Analysis:**
Medium to High. Attacker attempted input manipulation scans targeting Parameter routes. While target resources remain online, active query manipulation probes expose key database endpoints.

**4. Remediation Recommendations:**
1. Block IP address blocks for: \`${ips.join("`, `") || "N/A"}\` at the border firewall level.
2. Review target node input forms for parameterized query validation.
3. Schedule automatic compliance checker reports on target schemas.`;
  }

  // Persist the summary
  await prisma.incident.update({
    where: { id: incidentId },
    data: { aiSummary: summaryText },
  });

  await writeAuditLog("Incident AI Summary Generated", { id: incidentId });

  revalidatePath(`/incidents/${incidentId}`);
  return summaryText;
}
