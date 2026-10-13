import { NextResponse } from "next/server";
import { writeSecurityLog } from "@/lib/dashboard/security-logger";

export async function POST(request: Request) {
  try {
    const internalKey = request.headers.get("x-aegis-internal-key");
    const configuredKey = process.env.AEGIS_INTERNAL_KEY;
    if (!configuredKey || configuredKey.length < 32 || internalKey !== configuredKey) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ipAddress, eventType, details, userEmail, organizationId, userId } = body;

    await writeSecurityLog(
      ipAddress || null,
      eventType,
      details || {},
      userEmail || null,
      organizationId || null,
      userId || null
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API security log execution error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
