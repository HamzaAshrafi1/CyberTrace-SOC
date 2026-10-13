import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { org } = await verifyPermission("read:threats");
    const upstream = await fetch(`${AEGIS_SERVICE_URL}/api/v1/realtime/events`, {
      headers: await serviceHeaders(org.id, "read:threats"),
      signal: request.signal, cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) return new Response("Stream unavailable", { status: 503 });
    return new Response(upstream.body, { headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    }});
  } catch { return new Response("Unauthorized", { status: 403 }); }
}
