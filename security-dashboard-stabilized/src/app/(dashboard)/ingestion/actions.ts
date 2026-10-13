"use server";
import { randomBytes, randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
import { sanitizeString } from "@/lib/dashboard/security";

export async function getIngestionHistoryAction() {
  const { org } = await verifyPermission("read:threats");

  return prisma.ingestionHistory.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function processIngestionStreamAction(
  fileName: string,
  fileSize: string,
  events: { ip: string; message: string; source: string }[]
) {
  const { org } = await verifyPermission("write:threats");

  if (!events || events.length === 0) {
    throw new Error("No events to ingest");
  }

  // Soft limit to prevent server timeouts
  const maxEvents = 100;
  if (events.length > maxEvents) throw new Error("Upload at most 100 events per batch; nothing was ingested.");
  const eventsToProcess = events;
  const batchId = randomUUID();

  // Maintain organization isolation: Resolve or auto-register a default log source for this tenant
  let defaultSource = await prisma.logSource.findFirst({
    where: { organizationId: org.id, name: "manual-upload-source" },
  });
  if (!defaultSource) {
    defaultSource = await prisma.logSource.create({
      data: {
        organizationId: org.id,
        name: "manual-upload-source",
        apiKey: `ls_key_${randomBytes(32).toString("hex")}`,
      },
    });
  }
  const apiKey = defaultSource.apiKey;

  const sanitizedFileName = sanitizeString(fileName);
  let threatsCount = 0;
  let incidentsCount = 0;

  try {
    for (const [index, event] of eventsToProcess.entries()) {
      const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          apiKey: apiKey,
          source: sanitizeString(event.source || "manual-upload"),
          ip: sanitizeString(event.ip || "127.0.0.1"),
          message: event.message,
          eventId: `${batchId}:${index}`,
        }),
        signal: AbortSignal.timeout(4000), // Timeout per request
      });

      if (response.ok) {
        const result = await response.json();
        if (result.detected) {
          threatsCount++;
        }
        if (result.incident_created) {
          incidentsCount++;
        }
      } else {
        throw new Error(`Log ${index + 1} ingestion failed (${response.status}); earlier accepted logs remain stored.`);
      }
    }

    // Save job execution in IngestionHistory
    await prisma.ingestionHistory.create({
      data: {
        organizationId: org.id,
        fileName: sanitizedFileName,
        fileSize,
        eventsCount: eventsToProcess.length,
        threatsCount,
        incidentsCount,
        status: "success",
      },
    });
  } catch (error) {
    console.error("Critical Ingestion Job Failure:", error);

    await prisma.ingestionHistory.create({
      data: {
        organizationId: org.id,
        fileName: sanitizedFileName,
        fileSize,
        eventsCount: eventsToProcess.length,
        threatsCount: 0,
        incidentsCount: 0,
        status: "failed",
      },
    });
    throw new Error("Failed to process logs ingestion. Please check the Aegis service status.");
  }

  // Revalidate the views
  revalidatePath("/ingestion");
  revalidatePath("/threats");
  revalidatePath("/incidents");
  revalidatePath("/overview");

  // Write audit log
  await writeAuditLog("Log Upload Completed", { fileName, eventsCount: eventsToProcess.length });

  return {
    eventsCount: eventsToProcess.length,
    threatsCount,
    incidentsCount,
  };
}
