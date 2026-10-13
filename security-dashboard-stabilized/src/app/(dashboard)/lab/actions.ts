"use server";

import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
import { sanitizeString } from "@/lib/dashboard/security";
import { revalidatePath } from "next/cache";

export async function getSimulationHistoryAction() {
  const { org } = await verifyPermission("read:lab");

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/lab/runs?organization_id=${org.id}`, {
      method: "GET",
      headers: await serviceHeaders(org.id, "read:lab"),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Failed to load history: ${response.statusText}`);
    }

    const data = await response.json();
    return data.runs || [];
  } catch (error) {
    console.error("Failed to load simulation history:", error);
    return [];
  }
}

export async function launchSimulationAction(attackType: string) {
  const { org } = await verifyPermission("write:lab");
  const sanitizedAttackType = sanitizeString(attackType);

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/lab/simulate`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:lab"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: org.id,
        attack_type: sanitizedAttackType,
      }),
      signal: AbortSignal.timeout(20000), // simulation runs ingest multiple payloads
    });

    if (!response.ok) {
      const errDetail = await response.json().catch(() => ({}));
      throw new Error(errDetail.detail || `Server returned error status ${response.status}`);
    }

    const data = await response.json();

    await writeAuditLog("Simulation Attack Launched", {
      attackType: sanitizedAttackType,
      runId: data.id,
      severity: data.severity,
      eventsGenerated: data.eventsGenerated,
    });

    revalidatePath("/lab");
    return data;
  } catch (error) {
    console.error("Simulation run launch failure:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to launch attack simulation");
  }
}

export async function generateAiAttackAction(prompt: string) {
  const { org } = await verifyPermission("write:lab");
  const sanitizedPrompt = sanitizeString(prompt);

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/lab/ai-generate`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:lab"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: sanitizedPrompt,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      throw new Error(`AI generation returned error status ${response.status}`);
    }

    const data = await response.json();

    await writeAuditLog("AI Attack Telemetry Generated", {
      prompt: sanitizedPrompt,
      logLinesCount: data.logs?.length || 0,
    });

    return data.logs || [];
  } catch (error) {
    console.error("AI Attack generation action failed:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to generate AI logs");
  }
}
