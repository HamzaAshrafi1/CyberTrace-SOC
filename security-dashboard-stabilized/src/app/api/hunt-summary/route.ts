import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
export async function POST(request: Request) {
  try {
    const { org } = await verifyPermission("read:hunts");
    const input = await request.json();
    if (JSON.stringify(input).length > 16000) return new Response("Too large", { status: 413 });
    const res = await fetch(`${AEGIS_SERVICE_URL}/api/v1/summarize`, {
      method: "POST", headers: { "Content-Type": "application/json", ...await serviceHeaders(org.id, "read:hunts") },
      body: JSON.stringify(input), signal: AbortSignal.timeout(15000),
    });
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch { return new Response("Summary unavailable", { status: 503 }); }
}
