import { signServiceHeaders } from "./service-auth";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";

const LOGS_DIR = path.join(process.cwd(), "logs");
const SECURITY_LOG_FILE = path.join(LOGS_DIR, "security.log");

export async function writeSecurityLog(
  ipAddress: string | null,
  eventType: "auth_failure" | "authz_failure" | "rate_limit" | "invalid_api_key" | "suspicious",
  details: any,
  userEmail?: string | null,
  organizationId?: string | null,
  userId?: string | null
) {
  try {
    const timestamp = new Date().toISOString();
    const logPayload = {
      timestamp,
      ipAddress,
      eventType,
      details,
      userEmail: userEmail || null,
      organizationId: organizationId || null,
      userId: userId || null
    };

    // 1. Write to database SecurityLog table
    await prisma.securityLog.create({
      data: {
        organizationId: organizationId || null,
        userId: userId || null,
        userEmail: userEmail || null,
        ipAddress: ipAddress || null,
        eventType,
        details: details || {},
      }
    });

    // 2. Ensure log folder exists and write to logs/security.log
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.appendFileSync(SECURITY_LOG_FILE, JSON.stringify(logPayload) + "\n", "utf8");

    // 3. Publish real-time event via FastAPI endpoint
    try {
      const serviceUrl = process.env.AEGIS_SERVICE_URL || "http://localhost:8000";
      if (!organizationId) return; // System logs are not broadcast into tenant streams.
      await fetch(`${serviceUrl}/api/v1/realtime/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...signServiceHeaders(organizationId, "internal:publish"),
        },
        body: JSON.stringify({
          event_type: "security_log",
          data: {
            organizationId: organizationId || null,
            userId: userId || null,
            userEmail: userEmail || null,
            ipAddress: ipAddress || null,
            eventType,
            details: details || {},
            createdAt: timestamp,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to forward security log to realtime publisher:", err);
    }
  } catch (error) {
    console.error("Failed to write security event log:", error);
  }
}
