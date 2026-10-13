/**
 * Ingestion Log validator interfaces.
 * Maps to B2B firewall endpoints sending system events.
 */

export interface LogIngestPayload {
  nodeId: string;
  service: string;
  event: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  timestamp?: string;
  sourceIp?: string;
  targetNode?: string;
}

export function validateLogPayload(data: any): { success: boolean; data?: LogIngestPayload; error?: string } {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Payload must be a JSON object" };
  }

  const { nodeId, service, event, severity, timestamp, sourceIp, targetNode } = data;

  if (!nodeId || typeof nodeId !== "string" || nodeId.trim() === "") {
    return { success: false, error: "Missing or invalid 'nodeId' parameter" };
  }

  if (!service || typeof service !== "string" || service.trim() === "") {
    return { success: false, error: "Missing or invalid 'service' parameter" };
  }

  if (!event || typeof event !== "string" || event.trim() === "") {
    return { success: false, error: "Missing or invalid 'event' parameter" };
  }

  const validSeverities = ["critical", "high", "medium", "low", "info"];
  if (!severity || !validSeverities.includes(severity.toLowerCase())) {
    return { success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(", ")}` };
  }

  return {
    success: true,
    data: {
      nodeId: nodeId.trim(),
      service: service.trim(),
      event: event.trim(),
      severity: severity.toLowerCase() as any,
      timestamp: typeof timestamp === "string" ? timestamp : new Date().toISOString(),
      sourceIp: typeof sourceIp === "string" ? sourceIp : "0.0.0.0",
      targetNode: typeof targetNode === "string" ? targetNode : nodeId
    }
  };
}
