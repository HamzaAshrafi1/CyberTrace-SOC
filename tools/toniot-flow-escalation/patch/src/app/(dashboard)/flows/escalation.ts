"use server";
import prisma from "@/lib/prisma";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { revalidatePath } from "next/cache";
export type EscalationResult = { message: string; href?: string };
export async function escalateFlow(_state: EscalationResult, form: FormData): Promise<EscalationResult> {
 try {
  const { org, user } = await verifyPermission("write:threats");
  const flowId = String(form.get("flowId") ?? "");
  const reviewId = String(form.get("reviewId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const severity = String(form.get("severity") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  if (!["threat", "incident"].includes(kind) || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)
    || title.length < 5 || title.length > 160 || reason.length < 10 || reason.length > 2000
    || !flowId || flowId.length > 100 || !reviewId || reviewId.length > 100 || form.get("confirm") !== "yes")
   return { message: "Choose the record type and severity, enter a title (5–160 characters) and reason (10–2,000), and confirm creation." };
  if (kind === "incident") {
   const incidentContext = await verifyPermission("write:incidents");
   if (incidentContext.org.id !== org.id || incidentContext.user.id !== user.id) throw new Error("Permission context changed.");
  }
  const result = await prisma.$transaction(async tx => {
   await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS lock_request", org.id, flowId);
   const flow = await tx.flowRecord.findFirst({ where: { id: flowId, organizationId: org.id } });
   if (!flow) throw new Error("Flow unavailable.");
   const existing = await tx.flowEscalation.findFirst({ where: { flowId, organizationId: org.id } });
   if (existing) {
    if (existing.reviewId !== reviewId || existing.kind !== kind) throw new Error("This flow is already linked to a record. Refresh to view it.");
    return existing;
   }
   const review = await tx.flowReview.findFirst({ where: { flowId, organizationId: org.id }, orderBy: { revision: "desc" } });
   if (!review || review.id !== reviewId) throw new Error("Review changed. Refresh before creating a record.");
   if (review.decision !== "confirmed_suspicious") throw new Error("Save a confirmed suspicious review before creating a record.");
   if (review.evidenceHash !== flow.rawHash) throw new Error("Reviewed evidence does not match this flow.");
   const description = [flow.isSimulated ? "SYNTHETIC TEST EVIDENCE" : "Source-reported flow evidence; event time: " + flow.eventTime.toISOString(),
    "Explicit analyst escalation: " + reason, "Flow ID: " + flow.id, "Trace ID: " + flow.traceId,
    "Review ID: " + review.id + " (revision " + review.revision + ")", "Reviewer: " + review.reviewerEmail,
    "Review reason: " + review.reason, "Evidence SHA-256: " + flow.rawHash,
    "ML observations remain provisional and are not the basis for automatic response."].join("\n");
   let threatId: string | null = null, incidentId: string | null = null;
   const recordTitle = (flow.isSimulated ? "[SYNTHETIC] " : "") + title;
   if (kind === "threat") {
    const raw = JSON.parse(flow.rawRecord) as Record<string, unknown>;
    const threat = await tx.threatEvent.create({ data: { organizationId: org.id,
     sourceIp: String(raw["id.orig_h"] ?? "unknown"), target: String(raw["id.resp_h"] ?? "unknown"),
     severity, description: recordTitle + "\n" + description, rawPayload: flow.rawRecord,
     traceId: flow.traceId, rawHash: flow.rawHash, eventTime: flow.eventTime, isSimulated: flow.isSimulated,
     sourceEventId: "flow-escalation:" + flow.id, status: "New" } });
    threatId = threat.id;
   } else {
    const incident = await tx.incident.create({ data: { organizationId: org.id, title: recordTitle, description, severity, status: "open" } });
    incidentId = incident.id;
    await tx.incidentActivityLog.create({ data: { organizationId: org.id, incidentId, activityType: "created",
     description: "Explicitly created by " + user.email + " from flow " + flowId + ", review " + review.id } });
   }
   const link = await tx.flowEscalation.create({ data: { organizationId: org.id, flowId, reviewId,
    kind, threatId, incidentId, creatorId: user.id, creatorEmail: user.email, reason, evidenceHash: flow.rawHash } });
   await tx.auditLog.create({ data: { organizationId: org.id, userId: user.id, userEmail: user.email,
    action: "Flow Escalated By Analyst", metadata: { flowId, reviewId, escalationId: link.id, kind, threatId, incidentId, evidenceHash: flow.rawHash } } });
   return link;
  });
  revalidatePath("/flows"); revalidatePath("/threats"); revalidatePath("/incidents");
  return { message: "Linked " + result.kind + " record is available. No response action was run.",
   href: result.incidentId ? "/incidents/" + result.incidentId : "/threats" };
 } catch (error) {
  const safe = ["Flow unavailable.", "This flow is already linked to a record. Refresh to view it.", "Review changed. Refresh before creating a record.", "Save a confirmed suspicious review before creating a record.", "Reviewed evidence does not match this flow."];
  if (error instanceof Error && safe.includes(error.message)) return { message: error.message };
  console.error("Flow escalation failed", error);
  return { message: "Record could not be created. Check permissions and service status, then retry." };
 }
}
