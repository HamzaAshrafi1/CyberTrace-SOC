import "server-only";
import { createHmac } from "node:crypto";
import { verifyPermission } from "./verify-permission";
import type { Permission } from "./permissions";

export function signServiceHeaders(tenant: string, permission: string) {
  const secret = process.env.AEGIS_SERVICE_SECRET;
  if (!secret || secret.length < 32) throw new Error("AEGIS_SERVICE_SECRET must contain at least 32 characters");
  const claims = Buffer.from(JSON.stringify({ tenant, permission, exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(claims).digest("hex");
  return { "X-Aegis-Context": claims, "X-Aegis-Signature": signature };
}

export async function serviceHeaders(tenant: string, permission: Permission) {
  const { org } = await verifyPermission(permission);
  if (org.id !== tenant) throw new Error("Tenant mismatch");
  return signServiceHeaders(org.id, permission);
}
