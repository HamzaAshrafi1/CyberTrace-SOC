import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";

export async function GET() {
  const checks: Record<string, string> = {
    database: "disconnected",
    backend_service: "disconnected",
    chromadb: "disconnected",
    ai_provider: "unconfigured"
  };

  let isReady = true;

  // 1. Verify PostgreSQL Database Connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";
  } catch (error) {
    checks.database = `failed: ${error instanceof Error ? error.message : String(error)}`;
    isReady = false;
  }

  // 2. Verify FastAPI Backend Connection & downstream services (ChromaDB + AI configs)
  try {
    const backendRes = await fetch(`${AEGIS_SERVICE_URL}/health/ready`, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      checks.backend_service = "connected";
      checks.chromadb = data.chromadb || "disconnected";
      checks.ai_provider = data.ai_provider || "unconfigured";

      if (checks.chromadb !== "connected" || checks.ai_provider !== "configured") {
        isReady = false;
      }
    } else {
      checks.backend_service = `failed: HTTP ${backendRes.status}`;
      isReady = false;
    }
  } catch (error) {
    checks.backend_service = `failed: ${error instanceof Error ? error.message : String(error)}`;
    isReady = false;
  }

  const responseStatus = isReady ? 200 : 503;

  return NextResponse.json({
    status: isReady ? "ready" : "unready",
    timestamp: new Date().toISOString(),
    checks
  }, {
    status: responseStatus
  });
}
