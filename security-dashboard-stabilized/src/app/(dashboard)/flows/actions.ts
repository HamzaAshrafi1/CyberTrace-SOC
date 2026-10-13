"use server";
import prisma from "@/lib/prisma";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { revalidatePath } from "next/cache";
export async function saveFlowReview(_state: { message: string }, form: FormData) {
 try {
  const { org, user } = await verifyPermission("write:threats");
  const flowId = String(form.get("flowId") ?? "");
  const expected = String(form.get("expectedReviewId") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!["needs_investigation", "dismissed", "confirmed_suspicious"].includes(decision) || reason.length < 10 || reason.length > 2000 || flowId.length > 100)
   return { message: "Choose a decision and provide a reason of 10–2,000 characters." };
  await prisma.$transaction(async tx => {
   await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS lock_request", org.id, flowId);
   const flow = await tx.flowRecord.findFirst({ where: { id: flowId, organizationId: org.id } });
   if (!flow) throw new Error("Flow unavailable.");
   const latest = await tx.flowReview.findFirst({ where: { flowId, organizationId: org.id }, orderBy: { revision: "desc" } });
   if ((latest?.id ?? "") !== expected) throw new Error("Another review was saved. Refresh before reviewing again.");
   const review = await tx.flowReview.create({ data: { flowId, organizationId: org.id, reviewerId: user.id, reviewerEmail: user.email, decision, reason, revision: (latest?.revision ?? 0) + 1, evidenceHash: flow.rawHash } });
   await tx.auditLog.create({ data: { organizationId: org.id, userId: user.id, userEmail: user.email, action: "Flow Review Saved", metadata: { flowId, reviewId: review.id, decision, evidenceHash: flow.rawHash, revision: review.revision } } });
  });
  revalidatePath("/flows");
  return { message: "Review saved. No threat, incident, or response action was created." };
 } catch (error) {
  if (error instanceof Error && ["Flow unavailable.", "Another review was saved. Refresh before reviewing again."].includes(error.message)) return { message: error.message };
  console.error("Flow review failed", error);
  return { message: "Review could not be saved. Check your permissions and try again." };
 }
}
